import { expect, spyOn, test } from "bun:test";
import { Container } from "../container";

process.env.DB_CONNECTION = "pgsql";

test("importing the package builds no container", async () => {
  const register = spyOn(Container.prototype, "register");

  await import("../index.ts");

  expect(register).not.toHaveBeenCalled();
});
