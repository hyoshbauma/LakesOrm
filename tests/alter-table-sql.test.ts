import { expect, test } from "bun:test";
import { AlterTableBuilder } from "../src/database/lakes/builder/query-structure";

process.env.DB_CONNECTION = "pgsql";

interface User { id: number; firstName: string; lastName: string; total: number }

// collapse runs of whitespace so the assertions do not depend on spacing
const sql = (text: string) => text.replace(/\s+/g, " ").trim();

const alter = () => new AlterTableBuilder<User>("users");

test("each added column gets its own ADD COLUMN", () => {
  const built = alter().addColumn("firstName", "TEXT").addColumn("lastName", "TEXT").build();
  expect(sql(built.sql)).toBe('ALTER TABLE users ADD COLUMN "first_name" TEXT, ADD COLUMN "last_name" TEXT;');
});

test("adding and dropping in one statement", () => {
  const built = alter().addColumn("firstName", "TEXT").dropColumn("lastName").build();
  expect(sql(built.sql)).toBe('ALTER TABLE users ADD COLUMN "first_name" TEXT, DROP COLUMN "last_name";');
});

test("dropping only", () => {
  expect(sql(alter().dropColumn("lastName").build().sql)).toBe('ALTER TABLE users DROP COLUMN "last_name";');
});

test("an index-only change emits no empty ALTER TABLE", () => {
  const built = alter().addIndex("users_name_idx", ["firstName"]).build();
  expect(sql(built.sql)).toBe('CREATE INDEX IF NOT EXISTS "users_name_idx" ON "users" ("first_name");');
});

test("a generated column keeps its expression", () => {
  const built = alter().addGeneratedColumn("total", "INT", ["id"], "id * 2").build();
  expect(sql(built.sql)).toBe('ALTER TABLE users ADD COLUMN "total" INT NOT NULL GENERATED ALWAYS AS (id * 2) ;');
});
