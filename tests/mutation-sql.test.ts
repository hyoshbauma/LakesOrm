import { expect, test } from "bun:test";
import { CreateBuilder, DeleteQueryBuilder, UpdateBuilder, UpsertQueryBuilder } from "../src/database/lakes/builder/query-mutations";
import { CryptoAes256C } from "../src/database/lakes/tools/crypto";

process.env.DB_CONNECTION = "pgsql";

interface User { id: number; firstName: string; lastName: string; telephone: string }

// collapse runs of whitespace so the assertions do not depend on spacing
const sql = (text: string) => text.replace(/\s+/g, " ").trim();

test("update and delete convert the where column to snake_case", () => {
  const update = new UpdateBuilder<User>("users", []).set("lastName", "x").where("firstName", "=", "a").build();
  expect(sql(update.sql)).toBe("UPDATE users SET last_name = $1 , updated_at = NOW() WHERE first_name = $2 RETURNING *");
  expect(update.params).toEqual(["x", "a"]);

  const remove = new DeleteQueryBuilder<User>("users").where("firstName", "=", "a").build();
  expect(sql(remove.sql)).toBe("DELETE FROM users WHERE first_name = $1 ;");
  expect(remove.params).toEqual(["a"]);
});

test("an update without set() is refused", () => {
  expect(() => new UpdateBuilder<User>("users", []).where("id", "=", 1).build()).toThrow("call set()");
});

test("delete reports the number of deleted rows", async () => {
  const builder = new DeleteQueryBuilder<User>("users").where("id", ">", 0);
  (builder as any).lakesOrm = { driver: "pgsql", db: { query: async () => ({ rows: [], rowCount: 3 }) } };

  expect(await builder.save()).toBe(3);
});

test("upsert needs rows and conflict columns", () => {
  expect(() => new UpsertQueryBuilder<User>("users", []).values([]).build()).toThrow("No data provided");
  expect(() => new UpsertQueryBuilder<User>("users", []).values([{ firstName: "a" } as User]).build()).toThrow("conflictOn");
});

test("upsert updates the snake_case columns when doUpdateSet() is not called", () => {
  const built = new UpsertQueryBuilder<User>("users", [])
    .values([{ firstName: "a", telephone: "1" } as User])
    .conflictOn("telephone")
    .build();

  expect(sql(built.sql)).toBe(
    'INSERT INTO users (first_name, telephone) VALUES ($1, $2) ON CONFLICT ("telephone") DO UPDATE SET first_name = EXCLUDED.first_name, telephone = EXCLUDED.telephone, updated_at = NOW() RETURNING *;',
  );
});

test("the upsert fallback keeps the existing id and sets updated_at only once", () => {
  const built = new UpsertQueryBuilder<User & { updatedAt: Date }>("users", [])
    .values([{ id: 7, telephone: "1", updatedAt: new Date() } as User & { updatedAt: Date }])
    .conflictOn("telephone")
    .build();

  expect(sql(built.sql)).toEndWith(
    'ON CONFLICT ("telephone") DO UPDATE SET telephone = EXCLUDED.telephone, updated_at = NOW() RETURNING *;',
  );
});

test("an upsert with nothing left to update is still valid SQL", () => {
  const built = new UpsertQueryBuilder<User>("users", []).values([{ id: 7 } as User]).conflictOn("id").build();

  expect(sql(built.sql)).toEndWith('ON CONFLICT ("id") DO UPDATE SET updated_at = NOW() RETURNING *;');
});

test("doUpdateSet() does not assign updated_at twice", () => {
  const built = new UpsertQueryBuilder<User & { updatedAt: Date }>("users", [])
    .values([{ firstName: "a", telephone: "1" } as User & { updatedAt: Date }])
    .conflictOn("telephone")
    .doUpdateSet("firstName", "updatedAt")
    .build();

  expect(sql(built.sql)).toEndWith("DO UPDATE SET first_name = EXCLUDED.first_name, updated_at = NOW() RETURNING *;");
});

test("CreateBuilder.set() converts and encrypts like values()", () => {
  const builder = new CreateBuilder<User>("users", ["telephone"]).set("telephone", "123");
  const built = builder.build();

  expect(sql(built.sql)).toBe("INSERT INTO users (telephone) VALUES ($1) RETURNING *");
  expect(built.params[0]).not.toBe("123");
  expect(new CryptoAes256C(builder.appKey).decrypt(built.params[0] as string)).toBe("123");
});
