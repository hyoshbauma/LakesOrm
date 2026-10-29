import { expect, test } from "bun:test";
import { Container, Injectable, Singleton } from "../container";

test("@Singleton keeps the class name", () => {
  const Wrapped = Singleton(class UserTable {});

  expect(Wrapped.name).toBe("UserTable");
});

test("two @Singleton classes resolve to their own instances", () => {
  const UserTable = Singleton(class UserTable {});
  const OrderTable = Singleton(class OrderTable {});
  Injectable()(UserTable);
  Injectable()(OrderTable);

  const container = new Container().register([UserTable, OrderTable]);

  expect(container.get(UserTable)).toBeInstanceOf(UserTable);
  expect(container.get(OrderTable)).toBeInstanceOf(OrderTable);
  expect(container.get(OrderTable)).not.toBe(container.get(UserTable));
});
