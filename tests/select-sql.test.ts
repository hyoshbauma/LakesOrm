import { expect, test } from "bun:test";
import { QueryBuilder } from "../src/database/lakes/builder/query-builder";
import { JoinableQueryBuilder } from "../src/database/lakes/builder/query-joins";
import { QueryWithBuilder } from "../src/database/lakes/builder/query-relationship";
import { BaseModel } from "../src/database/lakes/models/model";

process.env.DB_CONNECTION = "pgsql";

interface User { id: number; firstName: string }
interface Order { id: number; userId: number; status: string; metaData: object }
interface Schema { user: User }
interface OrderItem { id: number; orderId: number }
interface ItemSchema { orderItem: OrderItem }

// collapse runs of whitespace so the assertions do not depend on spacing
const sql = (text: string) => text.replace(/\s+/g, " ").trim();

// replace the driver so the SQL is captured instead of sent to Postgres
function capture(builder: unknown, rows: unknown[] = []) {
  const seen: { sql: string; params: unknown[] }[] = [];
  (builder as any).lakesOrm = {
    driver: "pgsql",
    db: { query: async (text: string, params: unknown[]) => { seen.push({ sql: sql(text), params }); return { rows }; } },
  };
  return seen;
}

test("a join is separated from the table name and uses the real table and column names", () => {
  // the table's own columns come last, so its id, created_at and updated_at win over the joined table's
  const inner = new JoinableQueryBuilder<Order, Schema>("orders").innerJoin("user", "userId", "id").build();
  expect(sql(inner.sql)).toBe("SELECT *, orders.* FROM orders INNER JOIN users ON orders.user_id = users.id");

  const left = new JoinableQueryBuilder<Order, Schema>("orders").leftJoin("user", "userId", "id").build();
  expect(sql(left.sql)).toBe("SELECT *, orders.* FROM orders LEFT JOIN users ON orders.user_id = users.id");
});

test("a join converts a camelCase table key and right-hand column to snake_case", () => {
  const inner = new JoinableQueryBuilder<Order, ItemSchema>("orders").innerJoin("orderItem", "id", "orderId").build();
  expect(sql(inner.sql)).toBe("SELECT *, orders.* FROM orders INNER JOIN order_items ON orders.id = order_items.order_id");

  const left = new JoinableQueryBuilder<Order, ItemSchema>("orders").leftJoin("orderItem", "id", "orderId").build();
  expect(sql(left.sql)).toBe("SELECT *, orders.* FROM orders LEFT JOIN order_items ON orders.id = order_items.order_id");
});

test("selected columns on a join are kept as they are", () => {
  const built = new JoinableQueryBuilder<Order, Schema>("orders").innerJoin("user", "userId", "id").select("status").build();
  expect(sql(built.sql)).toBe("SELECT status FROM orders INNER JOIN users ON orders.user_id = users.id");
});

test("placeholders follow the parameter order, whatever the call order", () => {
  const inFirst = new QueryBuilder<Order>("orders").whereIn("userId", [7, 8]).where("status", "=", "paid").build();
  expect(sql(inFirst.sql)).toBe("SELECT * FROM orders WHERE status = $3 AND user_id IN ( $1 , $2 )");
  expect(inFirst.params).toEqual([7, 8, "paid"]);

  const whereFirst = new QueryBuilder<Order>("orders").where("status", "=", "paid").whereIn("userId", [7, 8]).build();
  expect(sql(whereFirst.sql)).toBe("SELECT * FROM orders WHERE status = $1 AND user_id IN ( $2 , $3 )");
  expect(whereFirst.params).toEqual(["paid", 7, 8]);
});

test("whereIn with an empty list matches nothing", () => {
  expect(sql(new QueryBuilder<Order>("orders").whereIn("userId", []).build().sql)).toBe("SELECT * FROM orders WHERE FALSE");
});

test("JSON conditions use the snake_case column", () => {
  const contains = new QueryBuilder<Order>("orders").whereJsonContains("metaData", { a: 1 }).build();
  expect(sql(contains.sql)).toBe("SELECT * FROM orders WHERE meta_data @> $1::jsonb");

  const equals = new QueryBuilder<Order>("orders").whereJsonEquals("metaData", ["a", "b"], "x").build();
  expect(sql(equals.sql)).toBe("SELECT * FROM orders WHERE meta_data -> 'a' ->> 'b' = $1");
});

test("count() keeps the whereIn condition and returns a number", async () => {
  const builder = new QueryBuilder<Order>("orders").where("status", "=", "paid").whereIn("userId", [7, 8]);
  const seen = capture(builder, [{ count: "2" }]);

  expect(await builder.count()).toBe(2);
  expect(seen[0]).toEqual({
    sql: "SELECT COUNT(*) FROM orders WHERE status = $1 AND user_id IN ( $2 , $3 )",
    params: ["paid", 7, 8],
  });
});

test("count() numbers placeholders by parameter order when whereIn comes first", async () => {
  const builder = new QueryBuilder<Order>("orders").whereIn("userId", [7, 8]).where("status", "=", "paid");
  const seen = capture(builder, [{ count: "2" }]);

  expect(await builder.count()).toBe(2);
  expect(seen[0]).toEqual({
    sql: "SELECT COUNT(*) FROM orders WHERE status = $3 AND user_id IN ( $1 , $2 )",
    params: [7, 8, "paid"],
  });
});

test("count() on a join", async () => {
  const builder = new JoinableQueryBuilder<Order, Schema>("orders").innerJoin("user", "userId", "id").where("status", "=", "paid");
  const seen = capture(builder, [{ count: "1" }]);

  expect(await builder.count()).toBe(1);
  expect(seen[0]).toEqual({
    sql: "SELECT COUNT(*) FROM orders INNER JOIN users ON orders.user_id = users.id WHERE status = $1",
    params: ["paid"],
  });
});

test("find() selects only the requested fields", async () => {
  let seen: { sql: string; params: unknown[] }[] = [];

  class Users extends BaseModel<User> {
    constructor() { super("users"); }
    override fromQuery() {
      const builder = super.fromQuery();
      seen = capture(builder);
      return builder;
    }
  }

  await new Users().find("id", 1, ["id", "firstName"]);
  expect(seen[0]?.sql).toBe("SELECT id, first_name FROM users WHERE id = $1");
});

test("the relationship builder's copy of where and whereIn behaves the same", () => {
  const [built] = new QueryWithBuilder<Order>("orders").whereIn("userId", [7, 8]).where("status", "=", "paid").build();
  expect(sql(built!.sql)).toBe("SELECT * FROM orders WHERE status = $3 AND user_id IN ( $1 , $2 )");
  expect(built!.params).toEqual([7, 8, "paid"]);

  const [empty] = new QueryWithBuilder<Order>("orders").whereIn("userId", []).build();
  expect(sql(empty!.sql)).toBe("SELECT * FROM orders WHERE FALSE");
});

test("the relationship builder's JSON conditions use the snake_case column", () => {
  const [contains] = new QueryWithBuilder<Order>("orders").whereJsonContains("metaData", { a: 1 }).build();
  expect(sql(contains!.sql)).toBe("SELECT * FROM orders WHERE meta_data @> $1::jsonb");

  const [equals] = new QueryWithBuilder<Order>("orders").whereJsonEquals("metaData", ["a", "b"], "x").build();
  expect(sql(equals!.sql)).toBe("SELECT * FROM orders WHERE meta_data -> 'a' ->> 'b' = $1");
});
