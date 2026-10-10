import { expect, test } from "bun:test";
import { CryptoAes256C } from "../src/database/lakes/tools/crypto";

process.env.DB_CONNECTION = "pgsql";
process.env.APP_KEY = "a-key-for-this-test";

// ---------- the cipher ----------

test("deterministic encryption: equal values give equal ciphertexts, different values differ", () => {
  const cipher = new CryptoAes256C("a-key-for-this-test");
  const id = "0b5e3f0e-6f0c-4d7b-9f39-0d3a5a1e2c11";

  expect(cipher.encryptDeterministic(id)).toBe(cipher.encryptDeterministic(id));
  expect(cipher.encryptDeterministic(id)).not.toBe(cipher.encryptDeterministic("another-id"));
  expect(cipher.encryptDeterministic(id)).not.toContain(id);
});

test("deterministic encryption round-trips and depends on the key", () => {
  const cipher = new CryptoAes256C("a-key-for-this-test");
  const other = new CryptoAes256C("another-key");
  const stored = cipher.encryptDeterministic("42");

  expect(cipher.decryptDeterministic(stored)).toBe("42");
  expect(other.encryptDeterministic("42")).not.toBe(stored);
  expect(() => other.decryptDeterministic(stored)).toThrow();
});

test("a tampered value, or one that was never encrypted, is rejected", () => {
  const cipher = new CryptoAes256C("a-key-for-this-test");
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
  const cipher = new CryptoAes256C("a-key-for-this-test");

  expect(cipher.decrypt(cipher.encrypt("secret"))).toBe("secret");
  expect(cipher.encrypt("secret")).not.toBe(cipher.encrypt("secret"));
});
