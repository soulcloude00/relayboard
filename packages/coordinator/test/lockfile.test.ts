import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root lockfile records coordinator workspace", async () => {
  const lock = JSON.parse(await readFile(new URL("../../../package-lock.json", import.meta.url), "utf8"));
  assert.equal(lock.packages["packages/coordinator"].name, "@relayboard/coordinator");
  assert.equal(lock.packages["node_modules/@relayboard/coordinator"].resolved, "packages/coordinator");
});
