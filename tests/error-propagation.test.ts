import { expect, test } from "bun:test";
import { Database } from "../src/database/lakes/builder/database";
import type { BuiltQuery } from "../src/database/lakes/interfaces/structure";

process.env.DB_CONNECTION = "pgsql";

const query: BuiltQuery = { sql: "SELECT 1", params: [] };

// A Database whose driver is replaced by a fake, so no Postgres is needed.
class Probe extends Database {
  constructor(run: () => unknown) {
    super();
    this.lakesOrm = { driver: "pgsql", db: { query: async () => run() } };
  }
  one<T>() { return this.executeOne<T>(query); }
  many<T>() { return this.execute<T>(query); }
}

test("executeOne rejects when the query fails", async () => {
  const probe = new Probe(() => { throw new Error("relation does not exist"); });
  await expect(probe.one()).rejects.toThrow("relation does not exist");
});

test("executeOne returns the first row, or null when there is none", async () => {
  expect(await new Probe(() => ({ rows: [{ id: 1 }, { id: 2 }] })).one<{ id: number }>()).toEqual({ id: 1 });
  expect(await new Probe(() => ({ rows: [] })).one()).toBeNull();
});

test("a multi-statement result, one result per statement, does not throw", async () => {
  const probe = new Probe(() => [{ command: "CREATE", rows: [] }, { command: "CREATE", rows: [] }]);
  expect(await probe.many()).toEqual([]);
  expect(await probe.one()).toBeNull();
});

test("a multi-statement result returns the rows of the last statement", async () => {
  const probe = new Probe(() => [{ rows: [{ id: 0 }] }, { rows: [{ id: 1 }] }]);
  expect(await probe.many()).toEqual([{ id: 1 }]);
  expect(await probe.one()).toEqual({ id: 1 });
});
