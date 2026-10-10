import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MigrationService } from "../src/database/lakes/migration.service";
import { ormPaths } from "../src/database/path-registry";

process.env.DB_CONNECTION = "pgsql";

// the runner logs its progress; keep the test output readable
spyOn(console, "log").mockImplementation(() => {});
spyOn(console, "error").mockImplementation(() => {});

// a MigrationService whose driver is a fake that records every statement
function service(lockIsFree: boolean) {
  const statements: string[] = [];
  const run = async (text: string) => {
    statements.push(text);
    const acquiring = /SET locked_at = NOW\(\)/.test(text);
    return { rows: [], rowCount: acquiring && lockIsFree ? 1 : 0 };
  };
  const svc = new MigrationService();
  (svc as any).lakesOrm = { driver: "pgsql", db: { query: run, connect: async () => ({ query: run, release() {} }) } };
  return { svc, statements };
}

const released = (statements: string[]) => statements.some((text) => /locked_at = NULL/.test(text));

// a migration file whose up/down read a field that only the instance has
const migrationFile = (name: string) => `
export class Migration {
  name = '${name}';
  timestamp = 1;
  secret = 'kept';
  async up() { return this.secret; }
  async down() { return this.secret; }
}
`;

let dir = "";
const extraPath = { path: "", referencesPath: "" };

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "lakes-migrations-"));
  extraPath.path = dir;
  await mkdir(join(dir, "migration"), { recursive: true });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("a run that does not get the lock does not release it", async () => {
  const { svc, statements } = service(false);

  await expect(svc.up()).rejects.toThrow("lock");
  expect(released(statements)).toBe(false);
});

test("a run that holds the lock releases it", async () => {
  const { svc, statements } = service(true);

  expect(await svc.up()).toEqual([]);
  expect(released(statements)).toBe(true);
});

test("a rollback that does not get the lock does not release it", async () => {
  const { svc, statements } = service(false);

  await expect(svc.down()).rejects.toThrow("lock");
  expect(released(statements)).toBe(false);
});

test("the lock is released only while this run still holds it", async () => {
  const { svc, statements } = service(true);
  await svc.up();

  // another run may have taken over the lock after it expired
  expect(statements.find((text) => /locked_at = NULL/.test(text))).toMatch(/WHERE id = 1 AND locked_by = \$1/);
});

test("the client is released even when releasing the lock fails", async () => {
  let releases = 0;
  const run = async (text: string) => {
    if (/locked_at = NULL/.test(text)) throw new Error("connection lost");
    return { rows: [], rowCount: /SET locked_at = NOW\(\)/.test(text) ? 1 : 0 };
  };
  const svc = new MigrationService();
  (svc as any).lakesOrm = { driver: "pgsql", db: { query: run, connect: async () => ({ query: run, release() { releases++; } }) } };

  await expect(svc.up()).rejects.toThrow("connection lost");
  expect(releases).toBe(1);
});

// loads the migrations of a folder of its own
async function loadFrom(files: Record<string, string>) {
  const own = await mkdtemp(join(tmpdir(), "lakes-migrations-"));
  await mkdir(join(own, "migration"), { recursive: true });
  for (const [name, source] of Object.entries(files)) await writeFile(join(own, "migration", name), source);

  const paths = { path: own, referencesPath: "" };
  ormPaths.push(paths);
  try {
    const svc = service(true).svc;
    return { svc, migrations: await svc.loadMigrations() };
  } finally {
    ormPaths.pop();
    await rm(own, { recursive: true, force: true });
  }
}

const migrationWith = (name: string, body: string) => `
export class Migration {
  name = '${name}';
  timestamp = 1;
  async up() { ${body} }
  async down() { ${body} }
}
`;

test("different migrations get different checksums", async () => {
  const { svc, migrations } = await loadFrom({
    "1_a.ts": migrationWith("a", "return 'a';"),
    "2_b.ts": migrationWith("b", "return 'b';"),
  });
  const [a, b] = await Promise.all(migrations.map((migration) => (svc as any).calculateChecksum(migration)));

  expect(a).not.toBe(b);
});

test("a migration without down() is refused with its file name", async () => {
  const source = "export class Migration { name = 'only_up'; timestamp = 1; async up() {} }";

  await expect(loadFrom({ "1_only_up.ts": source })).rejects.toThrow("Migration 1_only_up.ts must define up() and down()");
});

test("a missing migration folder means no migrations", async () => {
  const { svc } = service(true);

  expect(await svc.status()).toEqual({ pending: [], executed: [] });
});

test("up and down keep their instance", async () => {
  await writeFile(join(dir, "migration", "1_first.ts"), migrationFile("first"));
  ormPaths.push(extraPath);

  try {
    const [loaded] = await service(true).svc.loadMigrations();

    expect(await (loaded as any).up({})).toBe("kept");
    expect(await (loaded as any).down({})).toBe("kept");
  } finally {
    ormPaths.pop();
  }
});

test("two migrations with the same name are refused", async () => {
  await writeFile(join(dir, "migration", "2_first_again.ts"), migrationFile("first"));
  ormPaths.push(extraPath);

  try {
    await expect(service(true).svc.loadMigrations()).rejects.toThrow("Duplicate migration name: first");
  } finally {
    ormPaths.pop();
  }
});
