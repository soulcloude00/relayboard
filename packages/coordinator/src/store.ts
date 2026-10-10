import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type Thread = { id: string; intent: string; paths: string[]; updatedAt: string };
export type Claim = { path: string; threadId: string; createdAt: string };
export type Task = { id: string; title: string; status: "open" | "doing" | "done"; dependsOn: string[]; owner?: string };
export type BoardEvent = { sequence: number; type: "thread.updated" | "claim.created" | "claim.released" | "files.changed" | "task.updated"; threadId: string; paths?: string[]; at: string };
export type BoardState = { threads: Thread[]; claims: Claim[]; tasks: Task[]; events: BoardEvent[]; sequence: number };

const emptyState = (): BoardState => ({ threads: [], claims: [], tasks: [], events: [], sequence: 0 });
const overlaps = (a: string, b: string): boolean => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

export class BoardStore {
  #state: BoardState = emptyState();
  #queue: Promise<void> = Promise.resolve();
  readonly path: string;
  constructor(path: string) { this.path = path; }

  async load(): Promise<void> {
    try { this.#state = JSON.parse(await readFile(this.path, "utf8")) as BoardState; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }

  snapshot(): BoardState { return structuredClone(this.#state); }
  eventsSince(sequence: number, excluding?: string): BoardEvent[] {
    return this.#state.events.filter((event) => event.sequence > sequence && event.threadId !== excluding);
  }

  updateThread(input: Omit<Thread, "updatedAt">): Promise<BoardState> {
    return this.#mutate(() => {
      const thread = { ...input, updatedAt: new Date().toISOString() };
      this.#state.threads = [...this.#state.threads.filter((item) => item.id !== input.id), thread];
      this.#event("thread.updated", input.id, input.paths);
    });
  }

  claim(threadId: string, path: string): Promise<BoardState> {
    return this.#mutate(() => {
      const conflict = this.#state.claims.find((claim) => claim.threadId !== threadId && overlaps(claim.path, path));
      if (conflict) throw new ClaimConflict(path, conflict);
      if (!this.#state.claims.some((claim) => claim.threadId === threadId && claim.path === path)) {
        this.#state.claims.push({ path, threadId, createdAt: new Date().toISOString() });
        this.#event("claim.created", threadId, [path]);
      }
    });
  }

  release(threadId: string, path: string): Promise<BoardState> {
    return this.#mutate(() => {
      this.#state.claims = this.#state.claims.filter((claim) => !(claim.threadId === threadId && claim.path === path));
      this.#event("claim.released", threadId, [path]);
    });
  }

  changed(threadId: string, paths: string[]): Promise<BoardState> {
    return this.#mutate(() => { this.#event("files.changed", threadId, paths); });
  }

  upsertTask(threadId: string, task: Task): Promise<BoardState> {
    return this.#mutate(() => {
      for (const dependency of task.dependsOn) if (!this.#state.tasks.some((item) => item.id === dependency)) throw new Error(`Unknown dependency: ${dependency}`);
      this.#state.tasks = [...this.#state.tasks.filter((item) => item.id !== task.id), task];
      this.#event("task.updated", threadId);
    });
  }

  async #mutate(change: () => void): Promise<BoardState> {
    let output = emptyState();
    const operation = this.#queue.then(async () => { change(); await this.#persist(); output = this.snapshot(); });
    this.#queue = operation.then(() => undefined, () => undefined);
    await operation;
    return output;
  }
  #event(type: BoardEvent["type"], threadId: string, paths?: string[]): void {
    this.#state.sequence += 1;
    this.#state.events.push({ sequence: this.#state.sequence, type, threadId, paths, at: new Date().toISOString() });
  }
  async #persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.#state, null, 2)}\n`);
    await rename(temporary, this.path);
  }
}

export class ClaimConflict extends Error {
  readonly requestedPath: string;
  readonly claim: Claim;
  constructor(requestedPath: string, claim: Claim) {
    super(`${requestedPath} overlaps ${claim.path}, claimed by ${claim.threadId}`);
    this.requestedPath = requestedPath;
    this.claim = claim;
  }
}
