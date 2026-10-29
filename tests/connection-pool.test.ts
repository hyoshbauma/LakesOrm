import { expect, test } from "bun:test";
import { Database } from "../src/database/lakes/builder/database";

class Probe extends Database {
  get pool() { return this.lakesOrm.db; }
  get transactionPool() { return this.postgres; }
}

test("every builder uses the same pool", () => {
  process.env.DB_CONNECTION = "pgsql";
  expect(new Probe().pool).toBe(new Probe().pool);
});

test("the driver defaults to pgsql when DB_CONNECTION is not set", () => {
  delete process.env.DB_CONNECTION;
  const probe = new Probe();
  expect(probe.driver).toBe("pgsql");
  expect(probe.pool).not.toBeNull();
});

test("a pool that was ended is replaced", async () => {
  process.env.DB_CONNECTION = "pgsql";
  const first = new Probe().pool;
  await first.end();
  const second = new Probe().pool;
  expect(second).not.toBe(first);
  expect(second.ending).toBe(false);
});

test("a builder made before the pool was ended uses the replacement", async () => {
  process.env.DB_CONNECTION = "pgsql";
  const probe = new Probe();
  const first = probe.pool;
  await first.end();

  expect(probe.pool).not.toBe(first);
  expect(probe.pool.ending).toBe(false);
  expect(probe.transactionPool).toBe(probe.pool);
});

test("each builder uses the DATABASE_URL it was created with, and shares its pool", () => {
  process.env.DB_CONNECTION = "pgsql";
  const saved = process.env.DATABASE_URL;

  // a builder created before the application configured DATABASE_URL, e.g. at import
  delete process.env.DATABASE_URL;
  expect(new Probe().pool.options.connectionString).toBeUndefined();

  process.env.DATABASE_URL = "postgres://app@db-a.example/a";
  const a = new Probe();
  process.env.DATABASE_URL = "postgres://app@db-b.example/b";
  const b = new Probe();

  expect(a.pool.options.connectionString).toBe("postgres://app@db-a.example/a");
  expect(b.pool.options.connectionString).toBe("postgres://app@db-b.example/b");
  expect(new Probe().pool).toBe(b.pool);

  if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved;
});
