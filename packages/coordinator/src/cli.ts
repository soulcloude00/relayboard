#!/usr/bin/env node
import { resolve } from "node:path";
import { BoardStore } from "./store.js";
import { createCoordinatorServer } from "./server.js";

const port = Number(process.env.RELAYBOARD_PORT ?? 7337);
const statePath = resolve(process.env.RELAYBOARD_STATE ?? ".relayboard/board.json");
const store = new BoardStore(statePath);
await store.load();
createCoordinatorServer(store).listen(port, "127.0.0.1", () => console.log(`Relayboard coordinator listening on http://127.0.0.1:${port}`));
