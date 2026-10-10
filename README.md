# Relayboard

**Orchestrators isolate. Relayboard shares.**

Relayboard is a multi-agent coding harness where concurrent threads can see and coordinate around each other's work. It is a fork of [pi](https://github.com/earendil-works/pi), keeping pi's provider support, agent loop, extensions, and terminal UI while adding an in-harness shared coordination layer.

## The problem

Running agents in separate worktrees prevents immediate file collisions, but it hides the fact that one thread is redesigning code another thread is building against. Relayboard makes that coordination visible before merge time.

Relayboard does **not** promise conflict-free code or automatic merge magic. It gives threads shared facts and enforceable boundaries:

- each thread declares its intent and likely paths;
- file changes become notices for other threads on their next turn;
- overlapping file claims are warned or blocked inside the harness;
- tasks and dependencies live on one shared local board;
- one TUI shows the threads and board together.

## Architecture

```text
pi agent threads ââ
pi agent threads ââ¼ââ local coordinator daemon ââ .relayboard/board.json
pi agent threads ââ              â
                                 âââ pi TUI (first client)
```

The daemon owns thread intents, file claims, change events, and task dependencies. The TUI is the first client, not the coordination engine, so a desktop client can be added later without rewriting the core.

## Status

Early build. The first milestone contains the local coordinator skeleton and its persisted board model. It already models:

- atomic local state persistence;
- hierarchical file-claim conflict detection;
- change events with per-thread cursors;
- tasks with validated dependencies;
- a localhost JSON API.

The next milestone wires pi's edit tools and turn lifecycle into these APIs, then adds the multi-thread board view.

## Coordinator API

The coordinator listens on `127.0.0.1:7337` by default.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/state` | read the shared board |
| `GET` | `/v1/events?since=N&exclude=thread` | read other threads' notices after a cursor |
| `PUT` | `/v1/threads` | declare a thread's intent and likely paths |
| `POST` / `DELETE` | `/v1/claims` | claim or release a path; overlaps return `409` |
| `POST` | `/v1/changes` | publish changed paths |
| `PUT` | `/v1/tasks` | create or update a task with dependencies |

```bash
npm install
npm run relayboard:test
npm run relayboard:check
npm run build --workspace=@relayboard/coordinator
node packages/coordinator/dist/cli.js
```

## Prior art

[mcp_agent_mail](https://github.com/Dicklesworthstone/mcp_agent_mail) provides an MCP coordination side-channel with agent mailboxes and file reservations. Relayboard shares the goal of reducing multi-agent collisions. The difference is placement: Relayboard puts claims, change notices, and the task board inside one harness, where its own edit tool can enforce them by default instead of asking unrelated agents to opt into a separate service.

Other orchestrators commonly use worktrees or sandboxes to isolate concurrent agents. Relayboard can still use isolation, but its differentiator is shared live coordination across those threads.

## Relationship to pi

Relayboard is an independent MIT-licensed fork of pi. It is not affiliated with or endorsed by pi's maintainers. Upstream credit and license history are preserved. The aim is to keep the coordination layer narrow enough that useful pi improvements remain practical to pull forward.
