import { beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { BaseModel } from "../src/database/lakes/models/model";
import { CryptoAes256C } from "../src/database/lakes/tools/crypto";
import type { ColumnNames } from "../src/database/lakes/types/type-db";

process.env.DB_CONNECTION = "pgsql";
// APP_KEY is 32 random bytes, base64-encoded
const KEY = Buffer.alloc(32, 9).toString("base64");
const KEY_BYTES = Buffer.from(KEY, "base64");
// other test files change APP_KEY: set it before every test
beforeEach(() => { process.env.APP_KEY = KEY; });

interface User { id?: string; firstName: string; telephone?: string; meta?: object }
interface Order { id?: string; userId: string; total: number }
interface Plain { id?: number; name: string }

class UserTable extends BaseModel<User> {
  protected override encryptedIds: ColumnNames<User>[] = ["id"];
  constructor() { super("users"); }
}

class OrderTable extends BaseModel<Order> {
  // its own id, and the foreign key that points at an encrypted id
  protected override encryptedIds: ColumnNames<Order>[] = ["id", "userId"];
  constructor() { super("orders"); }
}

// a model that does not opt in
class PlainTable extends BaseModel<Plain> {
  constructor() { super("plains"); }
}

const cipher = new CryptoAes256C(KEY_BYTES);
const enc = (value: string) => cipher.encryptDeterministic(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// collapse runs of whitespace so the assertions do not depend on spacing
const sql = (text: string) => text.replace(/\s+/g, " ").trim();

// replace a builder's driver: record what it is sent and answer with canned rows
function fake<B>(builder: B, respond: (text: string, params: unknown[]) => unknown[] = () => []) {
  const seen: { sql: string; params: unknown[] }[] = [];
  (builder as any).lakesOrm = {
    driver: "pgsql",
    db: {
      query: async (text: string, params: unknown[] = []) => {
        seen.push({ sql: sql(text), params });
        const rows = respond(sql(text), params);
        return { rows, rowCount: rows.length };
      },
    },
  };
  return { builder, seen };
}

// ---------- the cipher ----------

test("deterministic encryption: equal values give equal ciphertexts, different values differ", () => {
  const cipher = new CryptoAes256C(KEY_BYTES);
  const id = "0b5e3f0e-6f0c-4d7b-9f39-0d3a5a1e2c11";

  expect(cipher.encryptDeterministic(id)).toBe(cipher.encryptDeterministic(id));
  expect(cipher.encryptDeterministic(id)).not.toBe(cipher.encryptDeterministic("another-id"));
  expect(cipher.encryptDeterministic(id)).not.toContain(id);
});

test("deterministic encryption round-trips and depends on the key", () => {
  const cipher = new CryptoAes256C(KEY_BYTES);
  const other = new CryptoAes256C("another-key");
  const stored = cipher.encryptDeterministic("42");

  expect(cipher.decryptDeterministic(stored)).toBe("42");
  expect(other.encryptDeterministic("42")).not.toBe(stored);
  expect(() => other.decryptDeterministic(stored)).toThrow();
});

test("a tampered value, or one that was never encrypted, is rejected", () => {
  const cipher = new CryptoAes256C(KEY_BYTES);
  const bytes = Buffer.from(cipher.encryptDeterministic("42"), "base64url");
  bytes[bytes.length - 1]! ^= 1;

  expect(() => cipher.decryptDeterministic(bytes.toString("base64url"))).toThrow("MAC doesn't match");
  // the first bytes are the MAC, which is also the IV: changing them is refused too
  bytes[bytes.length - 1]! ^= 1;
  bytes[0]! ^= 1;
  expect(() => cipher.decryptDeterministic(bytes.toString("base64url"))).toThrow("MAC doesn't match");
  expect(() => cipher.decryptDeterministic("42")).toThrow("not a valid encrypted value");
});

test("the randomised cipher still works next to it", () => {
  const cipher = new CryptoAes256C(KEY_BYTES);

  expect(cipher.decrypt(cipher.encrypt("secret"))).toBe("secret");
  expect(cipher.encrypt("secret")).not.toBe(cipher.encrypt("secret"));
});

// ---------- writing ----------

test("create generates a UUID, stores it encrypted and returns it decrypted", async () => {
  const { builder, seen } = fake(
    new UserTable().createQuery().values({ firstName: "John" }),
    (_text, params) => [{ first_name: params[0], id: params[1] }],
  );

  const row: any = await builder.save();
  const stored = seen[0]!.params[1] as string;

  expect(seen[0]!.sql).toBe("INSERT INTO users (first_name, id) VALUES ($1, $2) RETURNING *");
  expect(row.id).toMatch(uuid);
  expect(stored).toBe(enc(row.id));
  expect(row).toEqual({ firstName: "John", id: row.id });
});

test("a supplied id is kept, and build() gives the same query every time", () => {
  const given = new UserTable().createQuery().values({ id: "user-1", firstName: "John" }).build();
  expect(given.sql).toBe("INSERT INTO users (id, first_name) VALUES ($1, $2) RETURNING *");
  expect(given.params).toEqual([enc("user-1"), "John"]);

  const generated = new UserTable().createQuery().values({ firstName: "John" });
  expect(generated.build().params).toEqual(generated.build().params);
});

test("bulk insert gives every row its own encrypted id", () => {
  const builder = new OrderTable().insertQuery().values([
    { userId: "user-1", total: 5 },
    { userId: "user-1", total: 7 },
  ]);
  const built = builder.build();
  const [firstUser, , firstId, secondUser, , secondId] = built.params as string[];

  expect(sql(built.sql)).toBe("INSERT INTO orders (user_id, total, id) VALUES ($1, $2, $3), ($4, $5, $6) RETURNING *");
  expect(firstUser).toBe(enc("user-1"));
  expect(secondUser).toBe(enc("user-1"));
  expect(cipher.decryptDeterministic(firstId!)).toMatch(uuid);
  expect(cipher.decryptDeterministic(secondId!)).toMatch(uuid);
  expect(firstId).not.toBe(secondId);
  expect(builder.build().params).toEqual(built.params);
});

test("a foreign key encrypts to the same ciphertext as the id it points at", () => {
  const user = new UserTable().createQuery().values({ id: "user-1", firstName: "John" }).build();
  const order = new OrderTable().createQuery().values({ id: "order-1", userId: "user-1", total: 5 }).build();

  expect(user.params[0]).toBe(enc("user-1"));
  expect(order.params[1]).toBe(user.params[0]);
});

test("update encrypts ids in SET and in WHERE, delete in WHERE", () => {
  const update = new OrderTable().updateQuery().set("userId", "user-2").set("total", 9).where("id", "=", "order-1").build();
  expect(sql(update.sql)).toBe("UPDATE orders SET user_id = $1, total = $2 , updated_at = NOW() WHERE id = $3 RETURNING *");
  expect(update.params).toEqual([enc("user-2"), 9, enc("order-1")]);

  const remove = new OrderTable().deleteQuery().where("userId", "=", "user-1").build();
  expect(sql(remove.sql)).toBe("DELETE FROM orders WHERE user_id = $1 ;");
  expect(remove.params).toEqual([enc("user-1")]);
});

test("upsert generates ids but never updates the id of an existing row", () => {
  const built = new UserTable().upsetQuery().values([{ firstName: "John", telephone: "243" }]).conflictOn("telephone").build();

  expect(sql(built.sql)).toBe(
    'INSERT INTO users (first_name, telephone, id) VALUES ($1, $2, $3) ON CONFLICT ("telephone") DO UPDATE SET first_name = EXCLUDED.first_name, telephone = EXCLUDED.telephone, updated_at = NOW() RETURNING *;',
  );
  expect(cipher.decryptDeterministic(built.params[2] as string)).toMatch(uuid);
});

// ---------- reading and filtering ----------

test("where, whereIn and find compare against the encrypted value", async () => {
  const where = new OrderTable().fromQuery().where("userId", "=", "user-1").where("total", ">", 3).build();
  expect(sql(where.sql)).toBe("SELECT * FROM orders WHERE user_id = $1 AND total > $2");
  expect(where.params).toEqual([enc("user-1"), 3]);

  const whereIn = new UserTable().fromQuery().whereIn("id", ["user-1", "user-2"]).build();
  expect(sql(whereIn.sql)).toBe("SELECT * FROM users WHERE id IN ( $1 , $2 )");
  expect(whereIn.params).toEqual([enc("user-1"), enc("user-2")]);

  let seen: { sql: string; params: unknown[] }[] = [];
  class Users extends UserTable {
    override fromQuery() {
      const made = fake(super.fromQuery(), () => [{ id: enc("user-1"), first_name: "John" }]);
      seen = made.seen;
      return made.builder;
    }
  }

  expect(await new Users().find("id", "user-1")).toEqual({ id: "user-1", firstName: "John" });
  expect(seen[0]).toEqual({ sql: "SELECT * FROM users WHERE id = $1", params: [enc("user-1")] });
});

test("an encrypted id cannot be compared with a range or pattern operator", () => {
  expect(() => new UserTable().fromQuery().where("id", ">", "user-1")).toThrow("encrypted id");
  expect(() => new UserTable().fromQuery().where("id", "LIKE", "user%")).toThrow("encrypted id");
  expect(() => new OrderTable().updateQuery().set("total", 1).where("userId", "<", "user-1").build()).toThrow("encrypted id");
  expect(() => new OrderTable().deleteQuery().where("id", ">=", "order-1").build()).toThrow("encrypted id");

  expect(() => new UserTable().fromQuery().where("id", "!=", "user-1")).not.toThrow();
});

test("relationship loading works across encrypted ids", async () => {
  const childQueries: { sql: string; params: unknown[] }[] = [];

  class Orders extends OrderTable {
    override fromQuery() {
      return fake(super.fromQuery(), (text, params) => {
        childQueries.push({ sql: text, params });
        return [
          { id: enc("order-1"), user_id: enc("user-1"), total: 5 },
          { id: enc("order-2"), user_id: enc("user-2"), total: 7 },
        ];
      }).builder;
    }
  }

  const relation: any = { targetModel: new Orders(), foreignKey: "userId", type: "one" };
  const { builder } = fake(new UserTable().fromWithBuilder().withOnly(relation), () => [
    { id: enc("user-1"), first_name: "John" },
    { id: enc("user-2"), first_name: "Linda" },
  ]);

  expect(await builder.get()).toEqual([
    { id: "user-1", firstName: "John", orders: [{ id: "order-1", userId: "user-1", total: 5 }] },
    { id: "user-2", firstName: "Linda", orders: [{ id: "order-2", userId: "user-2", total: 7 }] },
  ]);
  expect(childQueries).toEqual([
    { sql: "SELECT * FROM orders WHERE user_id IN ( $1 , $2 )", params: [enc("user-1"), enc("user-2")] },
  ]);
});

test("a JSON column that contains a key named id is left alone", async () => {
  const { builder } = fake(new UserTable().fromQuery(), () => [
    { id: enc("user-1"), first_name: "John", meta: { id: 7, tags: [{ id: "not-encrypted" }] } },
  ]);

  expect(await builder.get()).toEqual([
    { id: "user-1", firstName: "John", meta: { id: 7, tags: [{ id: "not-encrypted" }] } },
  ]);
});

// ---------- guards ----------

test("encrypted ids need APP_KEY", () => {
  const key = process.env.APP_KEY;
  delete process.env.APP_KEY;

  try {
    expect(() => new UserTable().createQuery().values({ firstName: "John" }).build()).toThrow("APP_KEY");
    expect(() => new UserTable().fromQuery().where("id", "=", "user-1")).toThrow("APP_KEY");
  } finally {
    process.env.APP_KEY = key;
  }
});

test("a model that does not opt in behaves exactly as before", async () => {
  const created = new PlainTable().createQuery().values({ name: "a" }).build();
  expect(created).toEqual({ sql: "INSERT INTO plains (name) VALUES ($1) RETURNING *", params: ["a"] });

  const where = new PlainTable().fromQuery().where("id", ">", 5).whereIn("id", [1, 2]).build();
  expect(sql(where.sql)).toBe("SELECT * FROM plains WHERE id > $1 AND id IN ( $2 , $3 )");
  expect(where.params).toEqual([5, 1, 2]);

  const { builder } = fake(new PlainTable().fromQuery(), () => [{ id: 5, name: "a" }]);
  expect(await builder.get()).toEqual([{ id: 5, name: "a" }]);
});

// ---------- the cipher is pinned ----------

test("a known id encrypts to a known value, through APP_KEY and the model", () => {
  // changing the key handling or the cipher would make every stored id unreadable
  const known = "u-xn5Fix58TCTFuJds1JiE_r";

  expect(new CryptoAes256C(KEY_BYTES).encryptDeterministic("42")).toBe(known);
  expect(new UserTable().fromQuery().where("id", "=", "42").build().params).toEqual([known]);
});

test("different ids get different IVs, and the IV is keyed", () => {
  const ivOf = (id: string) => Buffer.from(enc(id), "base64url").subarray(0, 16).toString("hex");
  const ivs = new Set(Array.from({ length: 200 }, (_, n) => ivOf(`id-${n}`)));

  expect(ivs.size).toBe(200);
  // an unkeyed hash of the id would let anyone test a guessed id against the stored value
  expect(ivOf("42")).not.toBe(createHash("sha256").update("42").digest().subarray(0, 16).toString("hex"));
});

// ---------- every path that compares or returns ids ----------

test("the relationship builder encrypts the ids it compares", () => {
  const [built] = new UserTable().fromWithBuilder().where("id", "=", "user-1").whereIn("id", ["user-2"]).build();

  expect(built!.params).toEqual([enc("user-1"), enc("user-2")]);
});

test("a join compares this table's id written with its table name", () => {
  const join = (new UserTable().selectJoinQuery() as any).innerJoin("order", "id", "userId");

  expect(join.where("users.id", "=", "user-1").whereIn("users.id", ["user-2"]).build().params).toEqual([enc("user-1"), enc("user-2")]);
  expect(() => (new UserTable().selectJoinQuery() as any).where("users.id", ">", "user-1")).toThrow("encrypted id");
});

test("!= compares against the encrypted value too", () => {
  expect(new UserTable().fromQuery().where("id", "!=", "user-1").build().params).toEqual([enc("user-1")]);
});

test("upsert encrypts the id and the foreign keys of its rows", () => {
  const built = new OrderTable().upsetQuery().values([{ id: "order-1", userId: "user-1", total: 5 }]).conflictOn("id").build();

  expect(built.params).toEqual([enc("order-1"), enc("user-1"), 5]);
});

test("bulk insert, update and upsert return their rows decrypted", async () => {
  const row = () => [{ id: enc("order-1"), user_id: enc("user-1"), total: 5 }];
  const decrypted = [{ id: "order-1", userId: "user-1", total: 5 }];

  expect(await fake(new OrderTable().insertQuery().values([{ userId: "user-1", total: 5 }]), row).builder.save()).toEqual(decrypted);
  expect(await fake(new OrderTable().updateQuery().set("total", 5).where("id", "=", "order-1"), row).builder.save()).toEqual(decrypted);
  expect(await fake(new OrderTable().upsetQuery().values([{ id: "order-1", userId: "user-1", total: 5 }]).conflictOn("id"), row).builder.save()).toEqual(decrypted);
});

test("a value that cannot be a ciphertext, such as a joined table's numeric id, is returned as it is", async () => {
  const { builder } = fake(new UserTable().fromQuery(), () => [{ id: 7, first_name: "John" }]);

  expect(await builder.get()).toEqual([{ id: 7, firstName: "John" }]);
});
