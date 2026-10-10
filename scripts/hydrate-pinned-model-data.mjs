// Hydrate the model fixtures for this fork's pinned pi-ai release, not today's
// provider feeds. The release tarball is public data, pinned by SHA-512.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const url = "https://registry.npmjs.org/@earendil-works/pi-ai/-/pi-ai-0.86.1.tgz";
const integrity = "1XHhI6D/fyQdsBieHC/E/4zGKVOoGe4yDyX67VXvzoYkFsX/qE7NpZE7E1RC8e6Bz8B9oG/P+MQFXikv2/BGEg==";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "relayboard-model-data-"));
try {
 const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
 if (!response.ok) throw new Error(`Pinned model download failed: ${response.status}`);
 const bytes = Buffer.from(await response.arrayBuffer());
 if (createHash("sha512").update(bytes).digest("base64") !== integrity) throw new Error("Pinned model release integrity mismatch");
 const archive = join(temp, "models.tgz"); await writeFile(archive, bytes);
 execFileSync("tar", ["-xzf", archive, "-C", temp, "package/dist/providers/data"]);
 await cp(join(temp, "package/dist/providers/data"), join(root, "packages/ai/src/providers/data"), { recursive: true });
 execFileSync(process.execPath, [join(root, "packages/ai/scripts/check-model-data.ts")], { stdio: "inherit" });
} finally { await rm(temp, { recursive: true, force: true }); }
