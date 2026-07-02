/**
 * whisper-windows-mcp — pure logic library
 *
 * Side-effect-free (or fs-only) functions extracted from index.ts so they can be
 * unit-tested directly. No MCP/server/process state lives here. index.ts imports
 * these; the test suite (test/lib.test.mjs) imports the compiled dist/lib.js.
 */
import { resolve, relative, isAbsolute } from "path";
import { writeFileSync, renameSync } from "fs";
import { createHash, randomUUID } from "crypto";

/** Coerce a tool arg to a finite number, or undefined if it isn't one (rejects NaN/Infinity from bad input). */
export function coerceNum(v: unknown): number | undefined {
  // Only accept real numbers and numeric strings. Reject null / "" / booleans / arrays /
  // objects — Number() would silently coerce null, "", and [] to 0, which is loose input
  // we do not want reaching whisper-cli as a deliberate-looking 0.
  if (typeof v !== "number" && typeof v !== "string") return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Write JSON atomically (unique temp file + rename).
 * The rename makes the swap atomic at the filesystem level so a reader in ANOTHER
 * process never sees a half-written, torn file. The random temp suffix keeps two
 * writing processes from colliding on a shared temp name.
 * (Within a single Node process these writes are already serialized — writeFileSync
 * is synchronous and cannot interleave with another call on the event loop.)
 */
export function writeJsonAtomic(path: string, obj: unknown): void {
  const tmp = `${path}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  renameSync(tmp, path);
}

/** Estimate word count from transcript text. */
export function estimateWordCount(text: string): number {
  return text.split(/\s+/).filter((w: string) => w.trim().length > 0).length;
}

/**
 * Deterministic serialization with sorted keys: the SAME logical arguments produce the
 * SAME string regardless of the order the JSON keys were emitted in.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

/** Stable identity for a single privacy-gated operation: tool name + the full argument set. */
export function opKeyFor(tool: string, args: unknown): string {
  return createHash("sha256").update(tool + "\0" + stableStringify(args)).digest("hex");
}

/**
 * True if `child` resolves to a path strictly inside `parent` (not parent itself).
 * Normalizes both paths and uses relative() so a sibling-prefix dir ("models-evil")
 * cannot satisfy the check the way a naive startsWith(parent) would. Windows-safe
 * (drive-letter case handled by resolve/relative). NOTE: this is path-string
 * containment, not symlink-resolved — a junction inside parent is not followed.
 */
export function isInsideDir(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel);
}

// Job/batch identifiers are minted server-side (`job_<epochMs>_<8 hex>` /
// `batch_<epochMs>_<8 hex>`) and only ever echoed back by the client. They are
// interpolated directly into filesystem paths, so any value that is not the exact
// minted shape is rejected before it can reach join()/readFileSync/writeFileSync —
// closing directory traversal (e.g. "..\\..\\secret") into the job-file read/write/
// delete paths.
const JOB_ID_RE = /^job_\d+_[0-9a-f]{8}$/;
const BATCH_ID_RE = /^batch_\d+_[0-9a-f]{8}$/;

/** True only for a well-formed, server-minted job ID. Guards all job-file path building. */
export function isValidJobId(id: unknown): boolean {
  return typeof id === "string" && JOB_ID_RE.test(id);
}

/** True only for a well-formed, server-minted batch ID. Guards all batch-file path building. */
export function isValidBatchId(id: unknown): boolean {
  return typeof id === "string" && BATCH_ID_RE.test(id);
}

/** Recover the timestamped transcript lines from a whisper-cli log (drops diagnostic noise). */
export function extractTranscriptFromLog(logContent: string): string {
  return logContent
    .split(/\r?\n/)
    .filter((l: string) => /^\[\d{2}:\d{2}:\d{2}\.\d{3} --> /.test(l))
    .join("\n");
}

/** Largest start-timestamp (in whole seconds) seen in a whisper-cli log — the progress signal. */
export function parseLastTimestamp(logContent: string): number {
  const re = /\[(\d{2}):(\d{2}):(\d{2})\.\d{3} -->/g;
  let lastSec = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(logContent)) !== null) {
    const sec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    if (sec > lastSec) lastSec = sec;
  }
  return lastSec;
}

/** Format seconds as M:SS, or H:MM:SS past an hour. Zero/falsy → "?:??". */
export function formatDuration(sec: number): string {
  if (!sec) return "?:??";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Rough transcription-time estimate in SECONDS = a fixed model-LOAD cost + a per-second transcribe
 * rate. The load cost is what actually drives timeouts: whisper-cli reloads the model on EVERY
 * invocation (it is a one-shot CLI, no daemon), and loading large-v3 (2.9 GB) into a memory-
 * constrained GPU was MEASURED at ~2 min on a Vega 56 — so a 7:29 file's whisper-cli ran 3:56 total
 * (≈2 min load + ~2 min transcribe), tipping just past the 4-min MCP wall. Transcription speed was
 * never the bottleneck; the reload tax was. Conservative so it does not under-predict; the real
 * figures vary by model + hardware. (Calibration history: 0.12 then 0.40 then 0.60 single-ratio
 * guesses all mis-modeled this as a realtime factor before the components were measured.)
 */
const MODEL_LOAD_SEC_GPU = 110;  // fixed per-invocation model-load allowance, GPU (measured ~120s on a constrained 8 GB card)
const MODEL_LOAD_SEC_CPU = 30;   // CPU loads from system RAM — far cheaper than a constrained VRAM upload
export function estimateSec(durationSec: number, gpu: boolean): number {
  if (!durationSec) return 0;
  const load = gpu ? MODEL_LOAD_SEC_GPU : MODEL_LOAD_SEC_CPU;
  const transcribeRatio = gpu ? 0.3 : 1.5;
  return Math.round(load + durationSec * transcribeRatio);
}

/** estimateSec as a short human string ("~45s" / "~6m"); "?" when the duration is unknown. */
export function estimateTime(durationSec: number, gpu: boolean): string {
  if (!durationSec) return "?";
  const est = estimateSec(durationSec, gpu);
  return est < 60 ? `~${est}s` : `~${Math.round(est / 60)}m`;
}
