import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BoardStore, ClaimConflict } from "../src/store.js";

const store = async () => { const instance = new BoardStore(join(await mkdtemp(join(tmpdir(), "relayboard-")), "board.json")); await instance.load(); return instance; };
test("overlapping claims are gated across threads", async () => {
  const board = await store();
  await board.claim("a", "src/auth");
  await assert.rejects(() => board.claim("b", "src/auth/login.ts"), ClaimConflict);
  await board.claim("a", "src/auth/login.ts");
});
test("threads receive other threads' file changes after a cursor", async () => {
  const board = await store();
  await board.changed("a", ["src/auth/login.ts"]);
  await board.changed("b", ["src/billing.ts"]);
  assert.deepEqual(board.eventsSince(0, "b").map((event) => event.paths), [["src/auth/login.ts"]]);
});
test("tasks reject missing dependencies", async () => {
  const board = await store();
  await assert.rejects(() => board.upsertTask("a", { id: "ui", title: "TUI", status: "open", dependsOn: ["daemon"] }), /Unknown dependency/);
});
