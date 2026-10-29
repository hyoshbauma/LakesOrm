import { expect, test } from "bun:test";
import { QueryWithBuilder } from "../src/database/lakes/builder/query-relationship";
import { BaseModel } from "../src/database/lakes/models/model";
import { CryptoAes256C } from "../src/database/lakes/tools/crypto";

process.env.DB_CONNECTION = "pgsql";

// a parent builder whose driver returns canned rows and records the SQL it receives
function parent(rows: unknown[], fail = false) {
  const statements: string[] = [];
  const builder = new QueryWithBuilder<any>("users");
  (builder as any).lakesOrm = {
    driver: "pgsql",
    db: { query: async (text: string) => { statements.push(text); if (fail) throw new Error("db down"); return { rows }; } },
  };
  return { builder, statements };
}

// stands in for a related table model and records how it is queried
function related(tableName: string, rows: unknown[]) {
  const calls: { column: string; ids: unknown[] }[] = [];
  const model = {
    tableName,
    fromQuery: () => ({
      whereIn: (column: string, ids: unknown[]) => { calls.push({ column, ids }); return { get: async () => rows }; },
    }),
  };
  return { model, calls };
}

const relation = (model: object): any => ({ targetModel: model, foreignKey: "userId", type: "many" });

test("without parents the related table is not queried", async () => {
  const { builder, statements } = parent([]);
  const orders = related("orders", []);

  expect(await builder.withOnly(relation(orders.model)).get()).toEqual([]);
  expect(statements).toHaveLength(1);
  expect(orders.calls).toHaveLength(0);
});

test("without withOnly() the rows are returned", async () => {
  const { builder } = parent([{ id: 1, first_name: "John" }]);

  expect(await builder.get()).toEqual([{ id: 1, firstName: "John" }]);
});

test("every relation is loaded through its own model and attached", async () => {
  const { builder } = parent([{ id: 1 }, { id: 2 }]);
  const orders = related("orders", [{ id: 10, userId: 1 }, { id: 11, userId: 2 }, { id: 12, userId: 1 }]);
  const invoices = related("invoices", [{ id: 20, userId: 2 }]);

  const rows = await builder.withOnly(relation(orders.model)).withOnly(relation(invoices.model)).get();

  expect(rows).toEqual([
    { id: 1, orders: [{ id: 10, userId: 1 }, { id: 12, userId: 1 }], invoices: [] },
    { id: 2, orders: [{ id: 11, userId: 2 }], invoices: [{ id: 20, userId: 2 }] },
  ]);
  expect(orders.calls).toEqual([{ column: "user_id", ids: [1, 2] }]);
  expect(invoices.calls).toEqual([{ column: "user_id", ids: [1, 2] }]);
});

test("a failing query rejects", async () => {
  const { builder } = parent([], true);

  await expect(builder.get()).rejects.toThrow("db down");
});

test("the parent id must be selected", async () => {
  const { builder } = parent([{ first_name: "John" }]);

  await expect(builder.withOnly(relation(related("orders", []).model)).get()).rejects.toThrow("id column");
});


test("a relation with a tableKey is loaded and attached by that key", async () => {
  const { builder } = parent([{ id: 1, code: "A" }, { id: 2, code: "B" }]);
  const orders = related("orders", [{ id: 10, userCode: "A" }, { id: 11, userCode: "B" }, { id: 12, userCode: "A" }]);

  const rows = await builder.withOnly({ targetModel: orders.model, foreignKey: "userCode", tableKey: "code", type: "many" } as any).get();

  expect(orders.calls).toEqual([{ column: "user_code", ids: ["A", "B"] }]);
  expect(rows).toEqual([
    { id: 1, code: "A", orders: [{ id: 10, userCode: "A" }, { id: 12, userCode: "A" }] },
    { id: 2, code: "B", orders: [{ id: 11, userCode: "B" }] },
  ]);
});

test("a relation of type one gets its first matching row", async () => {
  const { builder } = parent([{ id: 1 }, { id: 2 }]);
  const profiles = related("profiles", [{ id: 30, userId: 1 }, { id: 31, userId: 1 }]);

  const rows = await builder.withOnly({ targetModel: profiles.model, foreignKey: "userId", type: "one" } as any).get();

  expect(rows[0]).toEqual({ id: 1, profiles: { id: 30, userId: 1 } });
  expect(rows[1].profiles).toBeUndefined();
});

test("without withOnly() the id does not have to be selected", async () => {
  const { builder } = parent([{ first_name: "John" }]);

  expect(await builder.select("firstName").get()).toEqual([{ firstName: "John" }]);
});

test("a second relation to the same table is refused instead of replacing the first", () => {
  const { builder } = parent([]);
  const sent = related("messages", []);
  const received = related("messages", []);

  builder.withOnly({ targetModel: sent.model, foreignKey: "senderId", type: "many" } as any);
  expect(() => builder.withOnly({ targetModel: received.model, foreignKey: "receiverId", type: "many" } as any)).toThrow("already loads messages");
});

test("a model's encrypted columns are decrypted in the parent rows", async () => {
  class Users extends BaseModel<any> {
    protected override encryptedColumns = ["telephone"];
    constructor() { super("users"); }
  }
  const builder = new Users().fromWithBuilder();
  const stored = new CryptoAes256C((builder as any).appKey).encrypt("123");
  (builder as any).lakesOrm = { driver: "pgsql", db: { query: async () => ({ rows: [{ id: 1, telephone: stored }] }) } };

  expect(await builder.get()).toEqual([{ id: 1, telephone: "123" }]);
});
