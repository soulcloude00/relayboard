import { describe, expect, it } from "vitest";
import { summarizeBoard } from "../examples/extensions/relayboard.js";

describe("Relayboard TUI summary", () => {
	it("counts peers, foreign claims, and unfinished tasks", () => {
		expect(
			summarizeBoard(
				{
					threads: [
						{ id: "mine", intent: "wire tui", paths: [] },
						{ id: "peer", intent: "api", paths: [] },
					],
					claims: [
						{ path: "packages/a", threadId: "mine" },
						{ path: "packages/b", threadId: "peer" },
					],
					tasks: [
						{ id: "a", title: "done", status: "done" },
						{ id: "b", title: "next", status: "open" },
					],
					sequence: 4,
				},
				"mine",
			),
		).toBe("relayboard 1 peers · 1 claims · 1 tasks");
	});
});
