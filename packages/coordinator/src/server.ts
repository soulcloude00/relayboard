import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { BoardStore, ClaimConflict, type Task } from "./store.js";

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};
const body = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
};

export const createCoordinatorServer = (store: BoardStore) => createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/v1/state") return json(response, 200, store.snapshot());
    if (request.method === "GET" && url.pathname === "/v1/events") return json(response, 200, { events: store.eventsSince(Number(url.searchParams.get("since") ?? 0), url.searchParams.get("exclude") ?? undefined) });
    const input = await body(request);
    if (request.method === "PUT" && url.pathname === "/v1/threads") return json(response, 200, await store.updateThread({ id: String(input.id), intent: String(input.intent), paths: input.paths as string[] }));
    if (request.method === "POST" && url.pathname === "/v1/claims") return json(response, 201, await store.claim(String(input.threadId), String(input.path)));
    if (request.method === "DELETE" && url.pathname === "/v1/claims") return json(response, 200, await store.release(String(input.threadId), String(input.path)));
    if (request.method === "POST" && url.pathname === "/v1/changes") return json(response, 202, await store.changed(String(input.threadId), input.paths as string[]));
    if (request.method === "PUT" && url.pathname === "/v1/tasks") return json(response, 200, await store.upsertTask(String(input.threadId), input.task as Task));
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    if (error instanceof ClaimConflict) return json(response, 409, { error: "claim_conflict", message: error.message, claim: error.claim });
    return json(response, 400, { error: "bad_request", message: error instanceof Error ? error.message : String(error) });
  }
});
