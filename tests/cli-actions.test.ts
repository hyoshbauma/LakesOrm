import { expect, spyOn, test } from "bun:test";
import { lakesOrmCtl } from "../src/database/ctl";
import { LakesFilesService } from "../src/database/lakes/lakesFiles.service";

process.env.DB_CONNECTION = "pgsql";

// runs the CLI with the given arguments against a fake facade and returns the exit code it asked for
async function exitCodeOf(args: string[], facade: object): Promise<number | undefined> {
  const argv = process.argv;
  const exit = spyOn(process, "exit").mockImplementation((() => undefined) as never);
  const error = spyOn(console, "error").mockImplementation(() => {});
  process.argv = ["bun", "lakes", ...args];
  try {
    lakesOrmCtl(facade as any);
    // the action runs asynchronously
    for (let i = 0; i < 40 && exit.mock.calls.length === 0; i++) await Bun.sleep(5);
    return exit.mock.calls[0]?.[0] as number | undefined;
  } finally {
    process.argv = argv;
    exit.mockRestore();
    error.mockRestore();
  }
}

test("a failing command exits with code 1 at once", async () => {
  const facade = { migrationUp: async () => { throw new Error("migration failed"); } };

  expect(await exitCodeOf(["migrate", "--up"], facade)).toBe(1);
});

test("a command that succeeds runs to the end and does not exit", async () => {
  let done = false;
  const facade = { migrationUp: async () => { await Bun.sleep(5); done = true; } };

  expect(await exitCodeOf(["migrate", "--up"], facade)).toBeUndefined();
  expect(done).toBe(true);
});

test("table file failures reach the command line", async () => {
  const files: any = Object.create(LakesFilesService.prototype);

  files.tableNamesFactory = () => ({ name: "users" });
  files.addTableJson = async () => { throw new Error("table already created"); };
  await expect(files.createTableFiles("users")).rejects.toThrow("table already created");

  files.getDatabaseTable = async () => ({ name: "users" });
  files.deleteTableJson = async () => { throw new Error("permission denied"); };
  await expect(files.deteleTableFiles("users")).rejects.toThrow("permission denied");
});
