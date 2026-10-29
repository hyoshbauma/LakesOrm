import { afterEach, expect, spyOn, test } from "bun:test";
import { createDecipheriv } from "node:crypto";
import { Database } from "../src/database/lakes/builder/database";
import { CryptoAes256C } from "../src/database/lakes/tools/crypto";

process.env.DB_CONNECTION = "pgsql";

// 32 bytes, base64-encoded, as `openssl rand -base64 32` prints them
const KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 8).toString("base64");

// "legacy value" encrypted with the built-in key, as rows stored without APP_KEY are
const LEGACY = "eyJpdiI6ImMxN2M4NWIxYzE2YjNiODI3MGViNmYyMmNjMmM0NWRlIiwiZW5jcnlwdGVkRGF0YSI6IjBiZWIwODY0MDcwZGE3OTFmM2ZmMTdiYWM0ZGQyODliIiwibWFjIjoiYzE2N2Y5OGEzYzY5NjYxZmYyYzgxZTQxYjNiYTcxNDc0Mzg0ZDUxM2UxNDgyNzQwMzZmY2ZjOTU2ZGViYzJmNCJ9";

// "column value" encrypted with KEY before encrypt-then-MAC: its MAC covers the plaintext
const OLD_MAC = "eyJpdiI6IjVmZTU4ZmNkOWIzZjNkNjVjMjQzZTk3YWYxYjI4ZTAyIiwiZW5jcnlwdGVkRGF0YSI6IjliZmRhODcwZDBmNGU0N2M0YTQxN2VkYWRjYmY4ZGEyIiwibWFjIjoiOGI0NDBkZmQwMDRhYWJkMTA3NGI3ODU2ZDBlZThiOGZiMGYyNGU4Y2ZiZjBkNTBjNDEyMjFhZWE1ZjcyNzMzZiJ9";

// "column value" encrypted with KEY in the current format, with a fixed IV
const PINNED = "eyJpdiI6IjAwMDEwMjAzMDQwNTA2MDcwODA5MGEwYjBjMGQwZTBmIiwiZW5jcnlwdGVkRGF0YSI6IjM5YTZlMzNjYTgwOTRkMzViZjc2ODFjYjZhYTBlNzM1IiwibWFjIjoiZmVkNTUxMzgxYjVhNzRlMzQ0ZGM1Y2FiZGYzZjg2YTEyMGI3ZmZiNmY0MzYwN2U5YWUxNDJhNGM4YjI4MGNjYSJ9";

// the other test files run in the same process: leave APP_KEY as it was
const savedKey = process.env.APP_KEY;
afterEach(() => {
  if (savedKey === undefined) delete process.env.APP_KEY; else process.env.APP_KEY = savedKey;
});

spyOn(console, "warn").mockImplementation(() => {});

// exposes the protected conversions; encrypted column names are stored in snake_case
class Probe extends Database {
  constructor(encrypted: string[]) { super(); this.encryptedColumns = encrypted; }
  toDb(row: Record<string, any>) { return this.convertKeysToSnakeCase(row); }
  fromDb<T>(row: T) { return this.camelizeKeys(row); }
  key() { return this.cipher(); }
}

test("a multi-word encrypted column is not stored in plaintext and round-trips", () => {
  process.env.APP_KEY = KEY;
  const probe = new Probe(["first_name"]);
  const stored = probe.toDb({ firstName: "John", lastName: "Kwena" });

  expect(stored.last_name).toBe("Kwena");
  expect(stored.first_name).not.toBe("John");
  expect(probe.fromDb(stored)).toEqual({ firstName: "John", lastName: "Kwena" });
});

test("null and the empty string pass through an encrypted column", () => {
  process.env.APP_KEY = KEY;
  const probe = new Probe(["telephone"]);

  expect(probe.toDb({ telephone: null })).toEqual({ telephone: null });
  expect(probe.fromDb({ telephone: null })).toEqual({ telephone: null });
  expect(probe.fromDb({ telephone: "" })).toEqual({ telephone: "" });
});

test("APP_KEY is used as the key bytes, with or without a base64: prefix", () => {
  for (const appKey of [KEY, `base64:${KEY}`]) {
    process.env.APP_KEY = appKey;
    const stored = new Probe(["telephone"]).toDb({ telephone: "123" });

    expect(new CryptoAes256C(Buffer.from(KEY, "base64")).decrypt(stored.telephone)).toBe("123");
  }
});

test("an APP_KEY that is not 32 bytes of base64 is refused", () => {
  for (const appKey of ["x", "!!!!", "c2hvcnQ=", "correct horse battery staple", `${KEY}!`]) {
    process.env.APP_KEY = appKey;

    expect(() => new Probe(["telephone"]).toDb({ telephone: "123" })).toThrow("APP_KEY must be 32 random bytes");
  }
});

test("a value encrypted with another APP_KEY does not decrypt", () => {
  process.env.APP_KEY = KEY;
  const stored = new Probe(["telephone"]).toDb({ telephone: "123" });

  process.env.APP_KEY = OTHER_KEY;
  expect(() => new Probe(["telephone"]).fromDb(stored)).toThrow();
});

test("a value stored with the built-in key is read without APP_KEY, and after APP_KEY is set", () => {
  delete process.env.APP_KEY;
  expect(new Probe(["telephone"]).fromDb({ telephone: LEGACY })).toEqual({ telephone: "legacy value" });

  process.env.APP_KEY = KEY;
  expect(new Probe(["telephone"]).fromDb({ telephone: LEGACY })).toEqual({ telephone: "legacy value" });

  // new values are written with APP_KEY
  const stored = new Probe(["telephone"]).toDb({ telephone: "123" });
  expect(new CryptoAes256C(Buffer.from(KEY, "base64")).decrypt(stored.telephone)).toBe("123");
});

test("the cipher is derived once and used by every conversion", () => {
  process.env.APP_KEY = KEY;
  const probe = new Probe(["telephone"]);
  const cipher = probe.key();
  expect(new Probe([]).key()).toBe(cipher);

  // count the calls that reach the cached cipher
  let calls = 0;
  const { encrypt, decrypt } = CryptoAes256C.prototype;
  cipher.encrypt = (value: string) => { calls++; return encrypt.call(cipher, value); };
  cipher.decrypt = (value: string) => { calls++; return decrypt.call(cipher, value); };
  try {
    expect(probe.fromDb(probe.toDb({ telephone: "123" }))).toEqual({ telephone: "123" });
    expect(calls).toBe(2);
  } finally {
    delete (cipher as any).encrypt;
    delete (cipher as any).decrypt;
  }
});

// a stored value changed in each of its parts
const flip = (hex: string, at: number) => { const bytes = Buffer.from(hex, "hex"); bytes[at]! ^= 1; return bytes.toString("hex"); };
const changed = (stored: string) => {
  const value = JSON.parse(Buffer.from(stored, "base64").toString());
  return [
    { ...value, encryptedData: flip(value.encryptedData, 15) }, // breaks the padding
    { ...value, iv: flip(value.iv, 0) },                         // keeps the padding valid
    { ...value, mac: flip(value.mac, 0) },
    { ...value, mac: undefined },
  ].map((value) => Buffer.from(JSON.stringify(value)).toString("base64"));
};

test("every change to a value gives the same error, whether its padding breaks or not", () => {
  const cipher = new CryptoAes256C(Buffer.from(KEY, "base64"));

  for (const value of changed(cipher.encrypt("4111 1111 1111 1111"))) {
    expect(() => cipher.decrypt(value)).toThrow("MAC doesn't match the orignal value");
  }
});

test("a value with the old MAC is still read, and every change to it gives the same error too", () => {
  process.env.APP_KEY = KEY;
  expect(new Probe(["telephone"]).fromDb({ telephone: OLD_MAC })).toEqual({ telephone: "column value" });

  const cipher = new CryptoAes256C(Buffer.from(KEY, "base64"));
  for (const value of changed(OLD_MAC)) {
    expect(() => cipher.decrypt(value)).toThrow("MAC doesn't match the orignal value");
  }
});

test("the format is pinned: a known value decrypts", () => {
  // changing the derived keys or what the MAC covers would make every stored value unreadable
  expect(new CryptoAes256C(Buffer.from(KEY, "base64")).decrypt(PINNED)).toBe("column value");
});

test("new values are encrypted with a key derived from APP_KEY, not with APP_KEY itself", () => {
  // values with the old MAC are decrypted with APP_KEY before they are checked: they must not help decrypt new values
  const value = JSON.parse(Buffer.from(new CryptoAes256C(Buffer.from(KEY, "base64")).encrypt("column value"), "base64").toString());
  const decipher = createDecipheriv("aes-256-cbc", Buffer.from(KEY, "base64"), Buffer.from(value.iv, "hex"));
  decipher.setAutoPadding(false);

  expect(Buffer.concat([decipher.update(Buffer.from(value.encryptedData, "hex")), decipher.final()]).toString("latin1")).not.toContain("column value");
});

test("a value written without APP_KEY is still read after APP_KEY is set", () => {
  delete process.env.APP_KEY;
  const stored = new Probe(["telephone"]).toDb({ telephone: "123" });

  process.env.APP_KEY = KEY;
  expect(new Probe(["telephone"]).fromDb(stored)).toEqual({ telephone: "123" });
});
