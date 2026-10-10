import { expect, spyOn, test } from "bun:test";
import { TransactionBuilder } from "../src/database/lakes/builder/query-transaction";

process.env.DB_CONNECTION = "pgsql";

// the builder logs its progress; keep the test output readable
spyOn(console, "log").mockImplementation(() => {});
spyOn(console, "error").mockImplementation(() => {});

// stands in for pg.Pool and counts what the transaction does with it
function fakePool(options: { failRollback?: boolean } = {}) {
  const state = { connects: 0, releases: 0, releaseErrors: [] as unknown[], statements: [] as string[] };
  const client = {
    query: async (sql: string) => {
      state.statements.push(sql);
      if (sql === "ROLLBACK" && options.failRollback) throw new Error("connection lost");
      return { rows: [] };
    },
    release: (error?: unknown) => { state.releases++; state.releaseErrors.push(error); },
  };
  return { state, pool: { connect: async () => { state.connects++; return client; } } };
}

class Tx extends TransactionBuilder {
  constructor(pool: unknown) { super(); this.postgres = pool as any; }
}

test("a committed transaction uses one client and releases it", async () => {
  const { state, pool } = fakePool();
  const tx = new Tx(pool);
  await tx.begin();
  tx.addOperation(async (client) => { await client.query("INSERT 1"); });

  expect(await tx.execute()).toEqual({ success: true, message: "Transaction completed." });
  expect(state.statements).toEqual(["BEGIN", "INSERT 1", "COMMIT"]);
  expect(state.connects).toBe(1);
  expect(state.releases).toBe(1);
});

test("a failing operation rolls back, releases the client and rejects", async () => {
  const { state, pool } = fakePool();
  const tx = new Tx(pool);
  await tx.begin();
  tx.addOperation(async () => { throw new Error("boom"); });

  await expect(tx.execute()).rejects.toThrow("boom");
  expect(state.statements).toEqual(["BEGIN", "ROLLBACK"]);
  expect(state.connects).toBe(1);
  expect(state.releases).toBe(1);
});

test("a builder can run a second transaction on a new client", async () => {
  const { state, pool } = fakePool();
  const tx = new Tx(pool);
  for (const n of [1, 2]) {
    await tx.begin();
    tx.addOperation(async (client) => { await client.query(`INSERT ${n}`); });
    await tx.execute();
  }

  expect(state.connects).toBe(2);
  expect(state.releases).toBe(2);
});

test("calling begin() twice keeps one client", async () => {
  const { state, pool } = fakePool();
  const tx = new Tx(pool);
  await tx.begin();
  await tx.begin();
  await tx.execute();

  expect(state.connects).toBe(1);
  expect(state.releases).toBe(1);
});

test("a client whose ROLLBACK failed is released with the error, so the pool destroys it", async () => {
  const { state, pool } = fakePool({ failRollback: true });
  const tx = new Tx(pool);
  await tx.begin();
  tx.addOperation(async () => { throw new Error("boom"); });

  await expect(tx.execute()).rejects.toThrow("boom");
  expect(state.releases).toBe(1);
  expect(state.releaseErrors[0]).toBeInstanceOf(Error);
});
