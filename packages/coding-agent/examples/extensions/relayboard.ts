/**
 * Relayboard TUI bridge.
 *
 * Connects a pi session to the local Relayboard coordinator, publishes its
 * intent, and keeps a compact shared-board summary in the footer.
 *
 * Usage:
 *   relayboard-coordinator &
 *   pi -e ./packages/coding-agent/examples/extensions/relayboard.ts
 *
 * Environment:
 *   RELAYBOARD_URL       coordinator base URL (default http://127.0.0.1:4317)
 *   RELAYBOARD_THREAD_ID stable thread id (defaults to the pi session id)
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Thread = { id: string; intent: string; paths: string[] };
type Claim = { path: string; threadId: string };
type Task = { id: string; title: string; status: "open" | "doing" | "done"; owner?: string };
type BoardState = { threads: Thread[]; claims: Claim[]; tasks: Task[]; sequence: number };

const baseUrl = (process.env.RELAYBOARD_URL ?? "http://127.0.0.1:4317").replace(/\/$/u, "");
const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
	const response = await fetch(`${baseUrl}${path}`, {
		...init,
		headers: { "content-type": "application/json", ...init?.headers },
		signal: AbortSignal.timeout(1500),
	});
	if (!response.ok) throw new Error(`Relayboard ${response.status}`);
	return (await response.json()) as T;
};

export function summarizeBoard(state: BoardState, threadId: string): string {
	const peers = state.threads.filter((thread) => thread.id !== threadId).length;
	const claims = state.claims.filter((claim) => claim.threadId !== threadId).length;
	const openTasks = state.tasks.filter((task) => task.status !== "done").length;
	return `relayboard ${peers} peers · ${claims} claims · ${openTasks} tasks`;
}

export default function relayboardExtension(pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | undefined;
	let threadId = process.env.RELAYBOARD_THREAD_ID;
	let context: ExtensionContext | undefined;

	const refresh = async (notify = false) => {
		if (!context || !threadId) return;
		try {
			const state = await json<BoardState>("/v1/state");
			context.ui.setStatus("relayboard", summarizeBoard(state, threadId));
			if (notify)
				context.ui.notify(`Relayboard: ${state.threads.length} threads, ${state.claims.length} claims`, "info");
		} catch (error) {
			context.ui.setStatus("relayboard", "relayboard offline");
			if (notify) context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		context = ctx;
		threadId ??= ctx.sessionManager.getSessionId();
		await refresh();
		if (!timer) timer = setInterval(() => void refresh(), 2000);
	});

	pi.on("session_shutdown", () => {
		if (timer) clearInterval(timer);
		timer = undefined;
		context?.ui.setStatus("relayboard", undefined);
	});

	pi.registerCommand("relayboard", {
		description: "Show the live Relayboard shared-board summary",
		handler: async (_args, ctx) => {
			context = ctx;
			threadId ??= ctx.sessionManager.getSessionId();
			await refresh(true);
		},
	});

	pi.registerCommand("relayboard-intent", {
		description: "Publish this thread's intent (usage: /relayboard-intent <text>)",
		handler: async (args, ctx) => {
			const intent = args.trim();
			if (!intent) return ctx.ui.notify("Usage: /relayboard-intent <text>", "warning");
			threadId ??= ctx.sessionManager.getSessionId();
			try {
				await json<BoardState>("/v1/threads", {
					method: "PUT",
					body: JSON.stringify({ id: threadId, intent, paths: [] }),
				});
				ctx.ui.notify("Relayboard intent published", "info");
				await refresh();
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
			}
		},
	});
}
