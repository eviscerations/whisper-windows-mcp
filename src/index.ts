#!/usr/bin/env node
/**
 * whisper-windows-mcp
 * A Windows-native MCP server for local audio transcription using whisper.cpp
 * https://github.com/eviscerations/whisper-windows-mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile, spawn } from "child_process";
import {
  existsSync, unlinkSync, readdirSync,
  writeFileSync, readFileSync, mkdirSync,
  openSync, closeSync, statSync,
} from "fs";
import { cpus, tmpdir } from "os";
import { join, extname, basename, dirname, resolve } from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";
import {
  coerceNum, writeJsonAtomic, estimateWordCount, opKeyFor, isInsideDir,
  isValidJobId, isValidBatchId,
  extractTranscriptFromLog, parseLastTimestamp, formatDuration, estimateSec, estimateTime,
} from "./lib.js";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const WHISPER_CLI_PATH =
  process.env.WHISPER_CLI_PATH ?? "C:\\whisper\\Release\\whisper-cli.exe";
// Mutable — switch_model updates this at runtime without restarting Claude Desktop.
let WHISPER_MODEL =
  process.env.WHISPER_MODEL ?? "C:\\whisper\\models\\ggml-base.en.bin";
const FFMPEG_PATH =
  process.env.FFMPEG_PATH ?? "ffmpeg";

// Windows system binaries we invoke implicitly (never at the user's request) are called by
// absolute path so a same-named executable planted in an earlier PATH directory cannot shadow
// them. Falls back to the conventional location if the environment does not expose SystemRoot.
const SYSTEM_ROOT = process.env.SystemRoot ?? process.env.windir ?? "C:\\Windows";
const TASKLIST_EXE = join(SYSTEM_ROOT, "System32", "tasklist.exe");
const WMIC_EXE = join(SYSTEM_ROOT, "System32", "wbem", "WMIC.exe");

// --- Persistent model server (whisper-server) ------------------------------
// Optional resident-model mode: run whisper.cpp's whisper-server so the model stays
// loaded across transcriptions, eliminating the per-invocation reload cost (~110s on a
// constrained GPU). Started and stopped EXPLICITLY (whisper_server tool), never as an
// always-on daemon: the resident model holds VRAM for the server's entire lifetime, so on
// a shared GPU it has to be a deliberate start-work-stop cycle to hand the card back to
// other processes. Bound to localhost only — never a routable interface.
const WHISPER_SERVER_PATH =
  process.env.WHISPER_SERVER_PATH ?? join(dirname(WHISPER_CLI_PATH), "whisper-server.exe");
const WHISPER_SERVER_HOST = "127.0.0.1";
const WHISPER_SERVER_PORT = (() => {
  const n = parseInt(process.env.WHISPER_SERVER_PORT ?? "8571", 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8571;
})();

const SYSTEM_THREADS = cpus().length;
const DEFAULT_THREADS = Math.max(2, Math.floor(SYSTEM_THREADS / 2));
const WHISPER_THREADS = parseInt(process.env.WHISPER_THREADS ?? String(DEFAULT_THREADS), 10);

// Optional global default GPU/Vulkan device index passed to whisper-cli as --device N.
// Lets a multi-GPU box pin a specific card without passing gpu_device on every call.
// Per-call gpu_device overrides this; unset → whisper-cli's own default (device 0).
// ⚠ This is the Vulkan ENUMERATION index (whisper-cli logs "ggml_vulkan: 0 = <name>"),
// which is NOT guaranteed to match Windows GPU0/GPU1 — read the startup log to pick correctly.
const _whisperGpuEnv = process.env.WHISPER_GPU_DEVICE;
const WHISPER_GPU_DEVICE: number | undefined =
  _whisperGpuEnv !== undefined && _whisperGpuEnv.trim() !== "" && !Number.isNaN(parseInt(_whisperGpuEnv, 10))
    ? parseInt(_whisperGpuEnv, 10)
    : undefined;

// Foreground transcription guard: if the estimated time (fixed model-load cost + transcribe) exceeds
// this many seconds, a blocking (foreground) run is refused and routed to background mode instead —
// avoiding a silent timeout against Claude Desktop's ~4-minute (240s) MCP tool-call ceiling.
// Default 210 leaves ~30s headroom under the wall. Configurable via WHISPER_FOREGROUND_MAX_SEC.
const FOREGROUND_MAX_SEC =
  parseInt(process.env.WHISPER_FOREGROUND_MAX_SEC ?? "210", 10) || 210;

/** Effective GPU device: a numeric per-call arg wins, else the WHISPER_GPU_DEVICE env default, else undefined. */
function resolveGpuDevice(arg: unknown): number | undefined {
  if (arg !== undefined) {
    const n = Number(arg);
    if (!Number.isNaN(n)) return n;
  }
  return WHISPER_GPU_DEVICE;
}


// Temp WAVs from BLOCKING transcriptions only — never detached-job temps (a running
// background whisper-cli still needs its WAV). Cleaned best-effort on graceful shutdown.
const activeTempFiles = new Set<string>();

// Resident whisper-server this process owns (null until started via the whisper_server tool).
// Tracked so we can hard-kill it on shutdown and free the VRAM it holds.
let serverChild: ReturnType<typeof spawn> | null = null;
let serverModel: string | null = null;   // model path the resident server currently holds
let serverStartedAt = 0;                  // epoch ms — for uptime reporting

function gracefulShutdown(signal: string): void {
  let cleaned = 0;
  for (const f of activeTempFiles) {
    try { if (existsSync(f)) { unlinkSync(f); cleaned++; } } catch { /* best effort */ }
  }
  // Kill the resident server we own so its VRAM is released rather than leaked on exit.
  let killedServer = false;
  if (serverChild && !serverChild.killed) {
    try { serverChild.kill(); killedServer = true; } catch { /* best effort */ }
  }
  console.error(`whisper-windows-mcp: ${signal} — cleaned ${cleaned} blocking temp file(s)${killedServer ? ", stopped resident server" : ""}, exiting.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Privacy configuration
// ---------------------------------------------------------------------------
/**
 * Global default: when true, all tool responses return metadata only
 * (filename, word count, save path). No transcript text appears in any tool
 * response or API call. Transcripts are still saved as local .txt files.
 * Required for HIPAA, GDPR, legal, financial, and NDA-protected content.
 *
 * Can be overridden per-call using the privacy_mode parameter on
 * transcribe_audio, transcribe_batch, start_batch, and check_progress.
 * Per-call override wins in either direction — no restart required to toggle.
 *
 * Set as global default in claude_desktop_config.json env section:
 *   "WHISPER_PRIVACY_MODE": "true"
 */
const WHISPER_PRIVACY_MODE =
  (process.env.WHISPER_PRIVACY_MODE ?? "false").toLowerCase() === "true";

/**
 * When true: skips the one-time first-use consent disclosure shown before
 * transcript text is sent to Claude's API. Set this once you understand the
 * privacy boundary and no longer need the reminder each session.
 * Has no effect when privacy mode is active — privacy mode uses its own
 * per-operation gate that always fires regardless of this setting.
 *
 * Set in claude_desktop_config.json env section:
 *   "WHISPER_CONSENT_ACKNOWLEDGED": "true"
 */
const WHISPER_CONSENT_ACKNOWLEDGED =
  (process.env.WHISPER_CONSENT_ACKNOWLEDGED ?? "false").toLowerCase() === "true";

const SUPPORTED_EXTENSIONS = [
  ".mp3", ".wav",
  ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v",
  ".m4a", ".ogg", ".flac", ".3gp", ".ts",
];
const NATIVE_EXTENSIONS = [".mp3", ".wav"];

// Security: reject files over this size to prevent runaway resource consumption.
const MAX_FILE_SIZE_MB = 10240; // 10 GB

// Security: patterns rejected in all file_path inputs.
const UNSAFE_PATH_RE = /(\.\.[/\\])|(^\\\\)/; // blocks .. traversal and UNC paths

// ---------------------------------------------------------------------------
// Privacy helpers
// ---------------------------------------------------------------------------

/**
 * Shown once per session before any transcript text is returned in non-privacy mode.
 * Contains explicit instructions for Claude to surface to the user and
 * halt until explicit user confirmation is received.
 */
const CONSENT_DISCLOSURE = [
  "⚠️  PRIVACY DISCLOSURE — EXPLICIT USER CONFIRMATION REQUIRED",
  "",
  "━".repeat(60),
  "INSTRUCTION FOR CLAUDE: Present this disclosure to the user in full.",
  "Ask: \"Do you confirm? (yes / no)\"",
  "Do NOT call this tool again until the user has explicitly replied yes.",
  "━".repeat(60),
  "",
  "Transcript text is about to be transmitted to Anthropic's API and processed",
  "externally. Once sent, it leaves your local machine.",
  "",
  "Your audio and video files never leave your machine. Transcript text is",
  "different — if returned to Claude, it is sent through the API.",
  "",
  "You must confirm before proceeding if this recording contains:",
  "  • Medical or patient information (HIPAA — 45 CFR §164)",
  "  • Legal proceedings or attorney-client communications (privilege)",
  "  • Personal data of EU/EEA residents (GDPR — Articles 13, 14, 28)",
  "  • Student educational records (FERPA — 20 U.S.C. §1232g)",
  "  • Financial or cardholder data (PCI-DSS, SOX)",
  "  • Confidential business information (trade secrets, NDA-protected)",
  "  • Any recording subject to contractual confidentiality",
  "",
  "For recordings that require full local privacy, enable privacy mode:",
  "  Per-call: pass privacy_mode=true to any transcription tool",
  "  Global:   add to claude_desktop_config.json env:",
  "  \"WHISPER_PRIVACY_MODE\": \"true\"",
  "",
  "To suppress this confirmation permanently for non-sensitive content:",
  "  \"WHISPER_CONSENT_ACKNOWLEDGED\": \"true\"",
  "",
  "━".repeat(60),
  "INSTRUCTION FOR CLAUDE: Ask the user the following question exactly,",
  "then wait for their response before taking any further action:",
  "",
  "\"⚠️ Before I return any transcript text, I need your explicit confirmation.",
  "Transcript content will be transmitted to Anthropic's API and processed",
  "externally — it will leave your local machine. Do you confirm? (yes / no)\"",
  "━".repeat(60),
].join("\n");

/**
 * Shown before every operation when privacy mode is active.
 * Identical text every time by design — repetition is the point.
 * Regulatory compliance requires informed consent before each operation.
 */
const PRIVACY_MODE_DISCLOSURE = [
  "🔒 PRIVACY MODE — CONFIRMATION REQUIRED BEFORE THIS OPERATION",
  "",
  "━".repeat(60),
  "INSTRUCTION FOR CLAUDE: Present this disclosure to the user in full.",
  "Ask: \"Do you confirm? (yes / no)\"",
  "Do NOT call this tool again until the user has explicitly replied yes.",
  "━".repeat(60),
  "",
  "WHISPER_PRIVACY_MODE is active for this operation.",
  "",
  "What will happen:",
  "  ✓ Audio/video will be transcribed LOCALLY on your machine",
  "  ✓ Transcript saved as a local file only — not returned to Claude's API",
  "  ✓ Raw audio and video files NEVER leave your machine",
  "  ✓ No transcript text will be transmitted to Anthropic under any circumstances",
  "",
  "What you must confirm:",
  "  ⚠ Audio processing begins on your local machine after you confirm",
  "  ⚠ This confirmation is required before every operation in privacy mode",
  "  ⚠ Do not disable privacy mode mid-session for regulated or sensitive material",
  "",
  "To disable per-call (non-sensitive content only): pass privacy_mode=false",
  "To disable globally: set WHISPER_PRIVACY_MODE=false and restart Claude Desktop",
  "",
  "━".repeat(60),
  "INSTRUCTION FOR CLAUDE: Ask the user the following question exactly,",
  "then wait for their response before taking any further action:",
  "",
  "\"🔒 Privacy mode is active. Audio will be transcribed locally and no transcript",
  "text will be sent to Anthropic's API. Confirm you want to proceed? (yes / no)\"",
  "━".repeat(60),
].join("\n");

// Per-operation privacy gate state.
// Each distinct operation (identified by a stable key over its tool name + arguments)
// arms independently: first call for that key shows the disclosure and blocks; the
// second call with the SAME key clears it and proceeds. Keying per-operation closes
// the v2.3.0 hole where a single global flag let one operation's confirmation be
// silently consumed by a different operation. Completely independent of
// sessionConsentGiven — serves different users and modes.
const privacyArmed = new Map<string, number>(); // opKey -> armed-at epoch ms
// Armed disclosures expire so an abandoned confirmation can never satisfy a later
// operation, and the map can never grow without bound on a long-lived server.
const PRIVACY_GATE_TTL_MS = 10 * 60 * 1000;

// Session-scoped consent tracking — resets each time Claude Desktop restarts
// the MCP server process. Pre-set from env var so users who have set
// WHISPER_CONSENT_ACKNOWLEDGED=true skip the gate entirely.
// Has no effect when privacy mode is active (privacy mode uses its own gate).
let sessionConsentGiven = WHISPER_CONSENT_ACKNOWLEDGED;



/**
 * Pre-transcription gate for privacy mode, scoped to a single operation by opKey.
 * Call this when effective privacy mode is active, BEFORE any audio processing.
 *
 * Returns true  → block this call, show PRIVACY_MODE_DISCLOSURE to user.
 * Returns false → user has confirmed THIS operation, proceed.
 *
 * Mechanism: first call for opKey arms it (block); the second call with the same
 * opKey clears it (allow). Each distinct operation is independent — confirming one
 * can never satisfy another. Stale arms older than PRIVACY_GATE_TTL_MS are evicted
 * on every call. Only call when effective privacy mode is active.
 */
function checkPrivacyGate(opKey: string): boolean {
  const now = Date.now();
  for (const [k, armedAt] of privacyArmed) {
    if (now - armedAt > PRIVACY_GATE_TTL_MS) privacyArmed.delete(k);
  }
  if (!privacyArmed.has(opKey)) {
    privacyArmed.set(opKey, now);
    return true;  // first sight of this exact operation — block, show disclosure
  }
  privacyArmed.delete(opKey);
  return false;   // same operation re-issued — user confirmed — allow
}

/** Returns the privacy mode disclosure as a tool response. */
function privacyGateBlock(): string {
  return PRIVACY_MODE_DISCLOSURE;
}

/**
 * Determines post-transcription transcript policy for non-privacy mode.
 * Only call this after confirming effective privacy mode is OFF.
 *
 * Returns:
 *   "consent_gate" — First transcript-returning call this session; show
 *                    disclosure and withhold text. Flips sessionConsentGiven
 *                    so subsequent calls proceed without re-prompting.
 *   "allow"        — Consent already given; return text normally.
 *
 * IMPORTANT: Only call when the tool is about to return actual transcript text
 * (i.e. job confirmed complete). Do NOT call for still-running jobs or error
 * paths — it would consume the consent gate without returning content.
 */
function transcriptPolicy(): "consent_gate" | "allow" {
  if (!sessionConsentGiven) {
    sessionConsentGiven = true;
    return "consent_gate";
  }
  return "allow";
}

/**
 * Metadata-only response used when privacy mode is active.
 * Returns file info and word count. No transcript text included.
 */
function privacyModeBlock(fileName: string, savedPath: string, text: string): string {
  const words = estimateWordCount(text);
  return (
    `✅ Transcription complete — privacy mode active.\n\n` +
    `Source:  ${fileName}\n` +
    `Words:   ~${words}\n` +
    `Saved:   ${savedPath}\n\n` +
    `Transcript text is not transmitted to Claude's API.\n` +
    `Access your transcript directly at the path above.`
  );
}

/**
 * Consent gate response block — shown on first transcript-returning call
 * in non-privacy mode. savedPath and text are optional: when called BEFORE
 * transcription (blocking mode), neither is available. When called AFTER
 * (background jobs via check_progress), both are present.
 */
function consentGateBlock(savedPath?: string, text?: string): string {
  const lines: string[] = [CONSENT_DISCLOSURE, ""];
  if (savedPath || text) {
    lines.push("─".repeat(60));
    if (savedPath) lines.push(`Saved:  ${savedPath}`);
    if (text) lines.push(`Words:  ~${estimateWordCount(text)}`);
    lines.push("");
  }
  lines.push("No transcript text has been returned. Reply 'yes' to confirm, then call the tool again to proceed.");
  return lines.join("\n");
}

function validatePaths(): string | null {
  if (!existsSync(WHISPER_CLI_PATH))
    return `whisper-cli.exe not found at: ${WHISPER_CLI_PATH}\nCheck WHISPER_CLI_PATH in claude_desktop_config.json`;
  if (!existsSync(WHISPER_MODEL))
    return `Whisper model not found at: ${WHISPER_MODEL}\nCheck WHISPER_MODEL in claude_desktop_config.json`;
  return null;
}

/**
 * Validate a user-supplied file path for security.
 * Rejects UNC paths (\\server\share), directory traversal (..),
 * and files exceeding the size guard.
 */
function validateInputPath(filePath: string): string | null {
  if (UNSAFE_PATH_RE.test(filePath)) {
    return `Invalid path: "${filePath}"\nPaths containing ".." or UNC paths (\\\\server\\share) are not allowed.`;
  }
  if (existsSync(filePath)) {
    try {
      const sizeMb = statSync(filePath).size / (1024 * 1024);
      if (sizeMb > MAX_FILE_SIZE_MB) {
        return `File too large: ${sizeMb.toFixed(0)} MB exceeds the ${MAX_FILE_SIZE_MB} MB limit.`;
      }
    } catch { /* ignore stat errors — existsSync already confirmed it exists */ }
  }
  return null;
}

/**
 * Validate and resolve a user-supplied model reference to an absolute path guaranteed
 * to live inside the configured models directory. Accepts a bare filename (resolved
 * against the models dir) or a full path. Returns { path } on success or { error } with
 * a caller-facing message. Shared by switch_model and the transcribe_audio `model`
 * override so the models-directory containment guarantee cannot be sidestepped by
 * passing a model path straight to a transcription tool.
 */
function resolveModelPath(modelInput: string): { path: string } | { error: string } {
  const trimmed = modelInput.trim();
  if (!trimmed.endsWith(".bin")) {
    return { error: `Invalid model: "${trimmed}"\nModel files must end in .bin` };
  }
  if (UNSAFE_PATH_RE.test(trimmed)) {
    return { error: `Invalid path: "${trimmed}"\nPaths containing ".." or UNC paths are not allowed.` };
  }
  const modelsDir = dirname(WHISPER_MODEL);
  // Normalize to an absolute, canonical path first so the containment check and every
  // downstream use operate on a clean path — never a relative-to-cwd or sibling-prefix string.
  const resolvedPath = resolve(
    trimmed.includes("\\") || trimmed.includes("/")
      ? trimmed
      : join(modelsDir, trimmed)
  );
  if (!isInsideDir(resolvedPath, modelsDir)) {
    return { error: `Security error: model must be within the configured models directory (${modelsDir}).` };
  }
  if (!existsSync(resolvedPath)) {
    return {
      error:
        `Model not found: ${resolvedPath}\n\n` +
        `Use list_models to see installed models, or download_model to install a new one.`,
    };
  }
  return { path: resolvedPath };
}


/**
 * Check whether a whisper-cli.exe process is already running.
 * Uses tasklist /FI which is available on all Windows versions.
 */
async function isWhisperRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      TASKLIST_EXE,
      ["/FI", "IMAGENAME eq whisper-cli.exe", "/NH"],
      { windowsHide: true }
    );
    return stdout.toLowerCase().includes("whisper-cli.exe");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Background job architecture
// ---------------------------------------------------------------------------
const JOBS_DIR = join(tmpdir(), "whisper-mcp-jobs");

// Mutex: prevents double-spawn when the exit handler and a concurrent
// check_batch_progress call both detect job completion simultaneously.
let batchSpawning = false;

/**
 * Delete .json and .log job files older than 7 days from the jobs directory.
 * Non-blocking — runs once at startup, errors are ignored.
 */
function cleanupOldJobFiles(): void {
  try {
    if (!existsSync(JOBS_DIR)) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const files = readdirSync(JOBS_DIR);
    let cleaned = 0;
    for (const file of files) {
      if (!file.endsWith(".json") && !file.endsWith(".log")) continue;
      const fullPath = join(JOBS_DIR, file);
      try {
        if (statSync(fullPath).mtimeMs < cutoff) {
          unlinkSync(fullPath);
          cleaned++;
        }
      } catch { /* ignore per-file errors */ }
    }
    if (cleaned > 0) {
      console.error(`whisper-windows-mcp: cleaned ${cleaned} old job file(s) from ${JOBS_DIR}`);
    }
  } catch { /* non-blocking, ignore all errors */ }
}

type OutputFormat = "text" | "timestamps" | "json" | "srt" | "vtt" | "lrc" | "csv";
type BackgroundFormat = "text" | "timestamps" | "srt" | "vtt" | "lrc" | "csv";

interface Job {
  jobId: string;
  pid: number;
  sourceFile: string;
  transcribeFrom: string;
  isTmp: boolean;
  outputPath: string;
  tmpOutputBase: string;
  outputFormat: BackgroundFormat;
  logPath: string;
  jobPath: string;
  startTime: string;
  model: string;
  language: string;
  threads: number;
  durationSec: number;
  status: "running" | "complete" | "failed";
  privacyMode: boolean;
}

function ensureJobsDir(): void {
  mkdirSync(JOBS_DIR, { recursive: true });
}

async function spawnDetached(
  filePath: string, model: string, language: string, threads: number,
  outputFormat: BackgroundFormat = "timestamps",
  extraOpts: Partial<WhisperOptions> = {},
  onExit?: () => void,
  privacyMode = false
): Promise<{ jobId: string; pid: number }> {
  // Hard backstop for the one-engine / shared-VRAM guarantee: never spawn a one-shot
  // whisper-cli job while the resident server holds the GPU. Handlers refuse earlier with
  // friendlier messages; this catches every remaining path (e.g. a batch advancing mid-flight).
  if (await isServerHealthy()) {
    throw new Error(
      "Cannot start a one-shot whisper-cli job while the resident model server is running — " +
      "they would contend for the GPU. Stop the server first with whisper_server action=\"stop\"."
    );
  }
  ensureJobsDir();

  const jobId = `job_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const logPath = join(JOBS_DIR, `${jobId}.log`);
  const jobPath = join(JOBS_DIR, `${jobId}.json`);

  // Convert to WAV first if needed (fast, blocking)
  let transcribeFrom = filePath;
  let isTmp = false;
  if (needsConversion(filePath)) {
    transcribeFrom = await convertToWav(filePath);
    isTmp = true;
  }

  // Use a clean ASCII job-ID-based output path to avoid Unicode filename issues.
  // readJobProgress moves the file to the correct destination after completion.
  const tmpOutputBase = join(JOBS_DIR, jobId);

  // Determine final destination path and file extension
  const sourceBase = filePath.replace(/\.[^.]+$/, "");
  const ext = outputFormat === "srt" ? ".srt"
    : outputFormat === "vtt" ? ".vtt"
    : outputFormat === "lrc" ? ".lrc"
    : outputFormat === "csv" ? ".csv"
    : ".txt";
  const outputPath = (outputFormat === "srt" || outputFormat === "vtt") && language !== "en" && language !== "auto"
    ? `${sourceBase}.${language}${ext}`
    : `${sourceBase}${ext}`;

  // Build args using shared options — ensures quality flags are always applied
  // in background mode, matching blocking mode behaviour.
  const lang = language === "auto" ? "auto" : language;
  const args = [
    "-m", model,
    "-f", transcribeFrom,
    "-l", lang,
    "-t", String(threads),
    ...(extraOpts.conditionOnPrevText ? [] : ["--max-context", "0"]),
    "--no-speech-thold", String(extraOpts.noSpeechThold ?? 0.6),
  ];

  if (extraOpts.temperature !== undefined) args.push("--temperature", String(extraOpts.temperature));
  if (extraOpts.prompt) args.push("--prompt", extraOpts.prompt);
  if (extraOpts.beamSize !== undefined) args.push("--beam-size", String(extraOpts.beamSize));
  if (extraOpts.bestOf !== undefined) args.push("--best-of", String(extraOpts.bestOf));
  if (extraOpts.gpuDevice !== undefined) args.push("--device", String(extraOpts.gpuDevice));
  if (extraOpts.processors !== undefined && extraOpts.processors > 1) args.push("-p", String(extraOpts.processors));
  if (extraOpts.offsetT !== undefined) args.push("--offset-t", String(extraOpts.offsetT));
  if (extraOpts.duration !== undefined) args.push("--duration", String(extraOpts.duration));
  if (extraOpts.diarize) args.push("--diarize");
  if (extraOpts.tinyDiarize) args.push("--tinydiarize");
  if (extraOpts.vadModel && existsSync(extraOpts.vadModel)) args.push("--vad", "--vad-model", extraOpts.vadModel);
  if (extraOpts.wordTimestamps) {
    args.push("--max-len", "1", "--split-on-word");
  } else {
    if (extraOpts.maxLen !== undefined) args.push("--max-len", String(extraOpts.maxLen));
    if (extraOpts.splitOnWord) args.push("--split-on-word");
  }

  // Output format flags
  if (outputFormat === "srt") {
    args.push("-osrt", "-of", tmpOutputBase);
  } else if (outputFormat === "vtt") {
    args.push("-ovtt", "-of", tmpOutputBase);
  } else if (outputFormat === "lrc") {
    args.push("-olrc", "-of", tmpOutputBase);
  } else if (outputFormat === "csv") {
    args.push("-ocsv", "-of", tmpOutputBase);
  } else if (outputFormat === "text") {
    args.push("-otxt", "-of", tmpOutputBase);
  }
  // "timestamps": no output file flag — stdout (redirected to log) contains
  // the timestamped transcript. extractTranscriptFromLog() recovers it on completion.

  // Spawn detached, redirect stdout+stderr to log file
  const logFd = openSync(logPath, "w");
  const child = spawn(WHISPER_CLI_PATH, args, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });
  closeSync(logFd);

  // Attach exit handler BEFORE unref so the batch can self-advance without polling.
  // child.once fires exactly once when the process exits. unref() still applies —
  // Node won't be kept alive just for this child.
  if (onExit) child.once("exit", onExit);
  child.unref();

  const pid = child.pid ?? 0;

  const job: Job = {
    jobId,
    pid,
    sourceFile: filePath,
    transcribeFrom,
    isTmp,
    outputPath,
    tmpOutputBase,
    outputFormat,
    logPath,
    jobPath,
    startTime: new Date().toISOString(),
    model,
    language,
    threads,
    durationSec: 0,
    status: "running",
    privacyMode,
  };

  writeJsonAtomic(jobPath, job);
  return { jobId, pid };
}

async function isPidRunning(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      TASKLIST_EXE,
      ["/FI", `PID eq ${pid}`, "/NH"],
      { windowsHide: true }
    );
    return stdout.toLowerCase().includes("whisper-cli.exe");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Persistent model server helpers
// ---------------------------------------------------------------------------
function serverBaseUrl(): string {
  return `http://${WHISPER_SERVER_HOST}:${WHISPER_SERVER_PORT}`;
}

/** True if a whisper-server answers on our configured port (ours or an adopted orphan). */
async function isServerHealthy(timeoutMs = 2000): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    await fetch(serverBaseUrl() + "/", { signal: ctl.signal });
    return true; // any HTTP response means it is listening
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Poll until the server answers or the deadline passes (model load can take a while). */
async function waitForServer(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerHealthy(2000)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Detect any whisper-server.exe process (including an orphan not started by us). */
async function isServerProcessRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      TASKLIST_EXE,
      ["/FI", "IMAGENAME eq whisper-server.exe", "/NH"],
      { windowsHide: true }
    );
    return stdout.toLowerCase().includes("whisper-server.exe");
  } catch {
    return false;
  }
}

// Per-call options the whisper-server HTTP API does NOT reliably honor (probe-confirmed:
// unknown form fields are silently ignored). We refuse rather than drop them silently,
// preserving the explicit-control guarantee. Keyed by WhisperOptions field → tool arg name.
const SERVER_UNSUPPORTED_OPTS: Array<[keyof WhisperOptions, string]> = [
  ["beamSize", "beam_size"], ["bestOf", "best_of"], ["wordTimestamps", "word_timestamps"],
  ["diarize", "diarize"], ["tinyDiarize", "tinydiarize"], ["vadModel", "vad_model"],
  ["offsetT", "offset_t"], ["duration", "duration"], ["maxLen", "max_segment_length"],
  ["splitOnWord", "split_on_word"], ["processors", "processors"], ["gpuDevice", "gpu_device"],
  ["conditionOnPrevText", "condition_on_prev_text"],
];
function unsupportedServerOpts(opts: Partial<WhisperOptions>): string[] {
  return SERVER_UNSUPPORTED_OPTS
    .filter(([k]) => opts[k] !== undefined && opts[k] !== false)
    .map(([, label]) => label);
}

function serverPadTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/**
 * Transcribe a WAV through the resident server. Returns the subtitle document verbatim
 * for srt/vtt, or a transcript built from verbose_json for text/timestamps/json.
 * Only the parameters the HTTP API honors are forwarded (see SERVER_UNSUPPORTED_OPTS);
 * callers guard advanced flags before reaching here.
 */
async function serverTranscribe(
  wavPath: string, outputFormat: OutputFormat, language: string,
  opts: Partial<WhisperOptions>
): Promise<string> {
  const rf = outputFormat === "srt" ? "srt"
    : outputFormat === "vtt" ? "vtt"
    : "verbose_json"; // text / timestamps / json are all derived from verbose_json

  const fd = new FormData();
  fd.set("file", new Blob([readFileSync(wavPath)]), basename(wavPath));
  fd.set("response_format", rf);
  fd.set("language", language === "auto" ? "auto" : language);
  if (opts.translate) fd.set("translate", "true");
  if (opts.temperature !== undefined) fd.set("temperature", String(opts.temperature));
  if (opts.prompt) fd.set("prompt", opts.prompt);
  if (opts.noSpeechThold !== undefined) fd.set("no_speech_thold", String(opts.noSpeechThold));

  const res = await fetch(serverBaseUrl() + "/inference", { method: "POST", body: fd });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`whisper-server /inference returned HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  if (rf === "srt" || rf === "vtt") return body.trim();

  let data: any;
  try { data = JSON.parse(body); }
  catch { throw new Error(`whisper-server returned a non-JSON response: ${body.slice(0, 300)}`); }

  if (outputFormat === "json") return JSON.stringify(data, null, 2);

  const segs: any[] = Array.isArray(data.segments) ? data.segments : [];
  if (outputFormat === "text") {
    const joined = segs.map((s) => String(s.text ?? "").trim()).filter(Boolean).join(" ").trim();
    return joined || String(data.text ?? "").trim();
  }
  // "timestamps"
  return segs
    .map((s) => `[${serverPadTime(Number(s.start) || 0)} --> ${serverPadTime(Number(s.end) || 0)}]  ${String(s.text ?? "").trim()}`)
    .join("\n");
}

/** Swap the resident server's model without a restart via POST /load. */
async function serverLoadModel(modelPath: string): Promise<void> {
  const fd = new FormData();
  fd.set("model", modelPath);
  const res = await fetch(serverBaseUrl() + "/load", { method: "POST", body: fd });
  const body = await res.text();
  if (!res.ok) throw new Error(`whisper-server /load returned HTTP ${res.status}: ${body.slice(0, 200)}`);
}

/**
 * Refusal response for an operation that would need one-shot whisper-cli while the resident
 * server holds the GPU. Phase 1 wires only the blocking transcribe path through the server.
 */
function serverBusyRefusal(what: string): { content: { type: "text"; text: string }[]; isError: true } {
  return {
    content: [{
      type: "text",
      text:
        `⛔ The resident model server is running, and ${what} is not routed through it yet.\n\n` +
        `Running one would spawn a second engine and contend for VRAM on the same GPU. ` +
        `Stop the server first to free the card:\n  whisper_server with action="stop"\n\n` +
        `then re-run. (Server-backed background/batch is planned for a later release.)`,
    }],
    isError: true,
  };
}


/**
 * Read job progress and return a status string.
 * privacyModeOverride: per-call override from check_progress privacy_mode param.
 * Wins over job.privacyMode if provided; job.privacyMode wins over global env var.
 */
async function readJobProgress(jobId: string, privacyModeOverride?: boolean): Promise<string> {
  const jobPath = join(JOBS_DIR, `${jobId}.json`);
  if (!existsSync(jobPath)) {
    return `❌ Job not found: ${jobId}\n\nThe job file may have been deleted or the ID is incorrect.`;
  }

  const job: Job = JSON.parse(readFileSync(jobPath, "utf8"));

  let logContent = "";
  if (existsSync(job.logPath)) {
    logContent = readFileSync(job.logPath, "utf8");
  }

  const lastSec = parseLastTimestamp(logContent);
  const isRunning = await isPidRunning(job.pid);
  const ext = job.outputFormat === "srt" ? ".srt"
    : job.outputFormat === "vtt" ? ".vtt"
    : job.outputFormat === "lrc" ? ".lrc"
    : job.outputFormat === "csv" ? ".csv"
    : ".txt";
  const tmpOutput = `${job.tmpOutputBase}${ext}`;
  const outputExists =
    existsSync(job.outputPath) ||
    existsSync(tmpOutput) ||
    (job.outputFormat === "timestamps" && existsSync(job.logPath));

  // Completed
  if (!isRunning && outputExists) {
    // Move or create final output file
    if (job.outputFormat === "timestamps") {
      if (!existsSync(job.outputPath) && existsSync(job.logPath)) {
        const transcript = extractTranscriptFromLog(readFileSync(job.logPath, "utf8"));
        if (transcript) {
          try { writeFileSync(job.outputPath, transcript, "utf8"); } catch (e: any) { console.error(`whisper-windows-mcp: failed to write transcript to ${job.outputPath}: ${e?.message}`); }
        }
      }
    } else if (existsSync(tmpOutput) && tmpOutput !== job.outputPath) {
      try {
        writeFileSync(job.outputPath, readFileSync(tmpOutput, "utf8"), "utf8");
        unlinkSync(tmpOutput);
      } catch (moveErr: any) {
        console.error(`whisper-windows-mcp: failed to move output to ${job.outputPath}: ${moveErr?.message}`);
      }
    }

    // Bug 2 fix: explicit check that the output file landed where expected.
    if (!existsSync(job.outputPath)) {
      job.status = "failed";
      writeJsonAtomic(job.jobPath, job);
      return (
        `❌ Output file write failed.\n\n` +
        `Transcription completed but the output could not be written to:\n${job.outputPath}\n\n` +
        `Check disk space and directory permissions.\n` +
        `Raw job data may be in: ${JOBS_DIR}`
      );
    }

    job.status = "complete";
    writeJsonAtomic(job.jobPath, job);

    // Clean up tmp wav if present
    if (job.isTmp && existsSync(job.transcribeFrom)) {
      try { unlinkSync(job.transcribeFrom); } catch { }
    }

    const outputContent = readFileSync(job.outputPath, "utf8").trim();

    // Effective privacy mode: per-call override → job setting → global env var.
    // transcriptPolicy() is only called for non-privacy mode (consent gate logic).
    // This keeps the two gate systems fully independent.
    const effectivePrivacy = privacyModeOverride ?? job.privacyMode ?? WHISPER_PRIVACY_MODE;
    if (effectivePrivacy) {
      return privacyModeBlock(basename(job.sourceFile), job.outputPath, outputContent);
    }

    const policy = transcriptPolicy();
    if (policy === "consent_gate") {
      return consentGateBlock(job.outputPath, outputContent);
    }

    // allow — return normally with preview
    const preview = job.outputFormat === "srt" || job.outputFormat === "vtt"
      ? outputContent.split("\n").slice(0, 20).join("\n")
      : outputContent.slice(0, 600);
    return (
      `✅ Complete!\n\n` +
      `Source: ${basename(job.sourceFile)}\n` +
      `Output: ${job.outputPath}\n\n` +
      `Preview:\n${preview}${outputContent.length > 600 && job.outputFormat !== "srt" && job.outputFormat !== "vtt" ? "..." : ""}`
    );
  }

  // Failed
  if (!isRunning && !outputExists) {
    job.status = "failed";
    writeJsonAtomic(job.jobPath, job);
    const lastLines = logContent.split(/\r?\n/).filter(l => l.trim()).slice(-5).join("\n");
    return (
      `❌ Failed or cancelled.\n\n` +
      `Source: ${basename(job.sourceFile)}\n` +
      `No output found at: ${job.outputPath}\n\n` +
      `Last log output:\n${lastLines || "(empty)"}`
    );
  }

  // Still running
  const elapsed = Math.round((Date.now() - new Date(job.startTime).getTime()) / 1000);
  const progressLine = lastSec > 0
    ? `Last segment: ${formatDuration(lastSec)}`
    : "Starting up...";

  return (
    `⏳ In progress...\n\n` +
    `Source: ${basename(job.sourceFile)}\n` +
    `Job ID: ${jobId}\n` +
    `Elapsed: ${formatDuration(elapsed)}\n` +
    `${progressLine}\n\n` +
    `Call check_progress with this job ID to get an update.`
  );
}

// ---------------------------------------------------------------------------
// Sequential batch with validation
// ---------------------------------------------------------------------------
interface BatchFile {
  filePath: string;
  fileName: string;
  durationSec: number;
  status: "pending" | "running" | "complete" | "failed";
  jobId?: string;
  failReason?: string;
}

interface BatchState {
  batchId: string;
  batchPath: string;
  folder: string;
  startTime: string;
  files: BatchFile[];
  currentIndex: number;
  status: "running" | "complete";
  model: string;
  language: string;
  threads: number;
  outputFormat: OutputFormat;
  privacyMode: boolean;
}

function validateTranscript(txtPath: string, durationSec: number): { valid: boolean; reason?: string } {
  if (!existsSync(txtPath)) return { valid: false, reason: "output file missing" };
  const content = readFileSync(txtPath, "utf8").trim();
  if (!content) return { valid: false, reason: "output file is empty" };
  const lines = content.split(/\n/).filter(l => l.trim()).length;
  const minExpected = Math.max(1, Math.floor(durationSec / 30));
  if (lines < minExpected) {
    return { valid: false, reason: `only ${lines} line(s) for ${Math.round(durationSec)}s audio (expected ≥${minExpected})` };
  }
  return { valid: true };
}

async function spawnNextBatchJob(state: BatchState): Promise<void> {
  // Mutex: prevents double-spawn between concurrent exit handler + check_batch_progress.
  if (batchSpawning) return;
  batchSpawning = true;
  try {
    for (let i = state.currentIndex; i < state.files.length; i++) {
      if (state.files[i].status === "pending") {
        state.currentIndex = i;
        state.files[i].status = "running";
        const f = state.files[i];
        const fmt = (state.outputFormat === "json" ? "text" : state.outputFormat) as BackgroundFormat;
        const { jobId } = await spawnDetached(
          f.filePath, state.model, state.language, state.threads,
          fmt,
          {},
          // Exit callback: batch self-advances without polling.
          () => { readBatchProgress(state.batchId).catch(() => {}); },
          state.privacyMode
        );
        state.files[i].jobId = jobId;
        writeJsonAtomic(state.batchPath, state);
        return;
      }
    }
    state.status = "complete";
    writeJsonAtomic(state.batchPath, state);
  } finally {
    batchSpawning = false;
  }
}

async function readBatchProgress(batchId: string): Promise<string> {
  const batchPath = join(JOBS_DIR, `${batchId}.batch.json`);
  if (!existsSync(batchPath)) {
    return `❌ Batch not found: ${batchId}\n\nThe batch file may have been deleted or the ID is incorrect.`;
  }

  const state: BatchState = JSON.parse(readFileSync(batchPath, "utf8"));

  const running = state.files.find(f => f.status === "running");
  if (running && running.jobId) {
    const jobPath = join(JOBS_DIR, `${running.jobId}.json`);
    if (existsSync(jobPath)) {
      const job = JSON.parse(readFileSync(jobPath, "utf8"));
      const isRunning = await isPidRunning(job.pid);

      if (!isRunning) {
        const ext = job.outputFormat === "srt" ? ".srt"
          : job.outputFormat === "vtt" ? ".vtt"
          : job.outputFormat === "lrc" ? ".lrc"
          : job.outputFormat === "csv" ? ".csv"
          : ".txt";
        const tmpOutput = `${job.tmpOutputBase}${ext}`;

        if (job.outputFormat === "timestamps") {
          if (!existsSync(job.outputPath) && existsSync(job.logPath)) {
            const transcript = extractTranscriptFromLog(readFileSync(job.logPath, "utf8"));
            if (transcript) {
              try { writeFileSync(job.outputPath, transcript, "utf8"); } catch (e: any) { console.error(`whisper-windows-mcp: failed to write transcript to ${job.outputPath}: ${e?.message}`); }
            }
          }
        } else if (existsSync(tmpOutput) && tmpOutput !== job.outputPath) {
          try {
            writeFileSync(job.outputPath, readFileSync(tmpOutput, "utf8"), "utf8");
            unlinkSync(tmpOutput);
          } catch { /* validateTranscript will catch missing output */ }
        }

        if (job.isTmp && existsSync(job.transcribeFrom)) {
          try { unlinkSync(job.transcribeFrom); } catch { }
        }

        const finalOutputExists = existsSync(job.outputPath);
        const validation = validateTranscript(job.outputPath, running.durationSec);
        if (finalOutputExists && validation.valid) {
          running.status = "complete";
        } else {
          running.status = "failed";
          running.failReason = validation.reason ?? "no output file";
        }

        state.currentIndex = state.files.indexOf(running) + 1;
        if (state.files.some(f => f.status === "pending")) {
          await spawnNextBatchJob(state);
        } else {
          state.status = "complete";
          writeJsonAtomic(batchPath, state);
        }
      } else {
        writeJsonAtomic(batchPath, state);
      }
    }
  } else if (state.status !== "complete" && state.files.some(f => f.status === "pending")) {
    await spawnNextBatchJob(state);
  }

  // Build status report
  const done = state.files.filter(f => f.status === "complete").length;
  const failed = state.files.filter(f => f.status === "failed");
  const pending = state.files.filter(f => f.status === "pending").length;
  const currentRunning = state.files.find(f => f.status === "running");
  const total = state.files.length;
  const elapsed = Math.round((Date.now() - new Date(state.startTime).getTime()) / 1000);

  let report = `Batch: ${batchId}\n`;
  report += `Folder: ${state.folder}\n`;
  report += `${"─".repeat(50)}\n`;
  report += `Progress: ${done}/${total} complete`;
  if (failed.length > 0) report += ` | ${failed.length} failed`;
  if (pending > 0) report += ` | ${pending} remaining`;
  report += `\nElapsed: ${formatDuration(elapsed)}\n`;

  if (currentRunning) {
    report += `\nCurrently processing: ${currentRunning.fileName}`;
    if (currentRunning.jobId) {
      const jobPath = join(JOBS_DIR, `${currentRunning.jobId}.json`);
      if (existsSync(jobPath)) {
        const job = JSON.parse(readFileSync(jobPath, "utf8"));
        const logContent = existsSync(job.logPath) ? readFileSync(job.logPath, "utf8") : "";
        const lastSec = parseLastTimestamp(logContent);
        if (lastSec > 0) report += ` (${formatDuration(lastSec)} / ${formatDuration(currentRunning.durationSec)})`;
      }
    }
  }

  if (failed.length > 0) {
    report += `\n\n⚠️  Failed files:\n`;
    for (const f of failed) {
      report += `  ❌ ${f.fileName} — ${f.failReason ?? "unknown reason"}\n`;
    }
    report += `\nRe-run failed files with transcribe_audio individually.`;
  }

  if (state.status === "complete") {
    report = `✅ Batch complete!\n\n` + report;
  } else {
    report += `\n\nCall check_batch_progress again to update.`;
  }

  return report;
}

// ---------------------------------------------------------------------------
// GPU / system detection
// ---------------------------------------------------------------------------
interface GpuInfo {
  name: string;
  vramBytes: number;
}

async function detectGpus(): Promise<GpuInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      WMIC_EXE,
      ["path", "win32_VideoController", "get", "name,AdapterRAM", "/format:csv"],
      { windowsHide: true }
    );
    const gpus: GpuInfo[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("Node") || trimmed.startsWith(",AdapterRAM")) continue;
      const parts = trimmed.split(",");
      if (parts.length < 3) continue;
      const vramBytes = parseInt(parts[1] ?? "0", 10) || 0;
      const name = (parts[2] ?? "").trim();
      if (name && name !== "Name") gpus.push({ name, vramBytes });
    }
    return gpus;
  } catch {
    return [];
  }
}

function formatVram(bytes: number): string {
  if (!bytes || bytes < 1024 * 1024) return "Unknown";
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / (1024 * 1024))} MB`;
}

function recommendedModel(vramBytes: number): string {
  const gb = vramBytes / (1024 * 1024 * 1024);
  if (gb >= 6) return "large-v3-turbo (ggml-large-v3-turbo.bin) — ~6x faster than large-v3, minimal accuracy loss for English";
  if (gb >= 4) return "medium.en (ggml-medium.en.bin) — good fit for your VRAM";
  if (gb >= 2) return "small.en (ggml-small.en.bin) — safe choice for your VRAM";
  return "base.en (ggml-base.en.bin) — recommended for limited VRAM";
}

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------
interface ModelEntry {
  name: string;
  filename: string;
  sizeMb: number;
  multilingual: boolean;
  quantized: boolean;
  useCase: string;
  url: string;
}

const MODEL_REGISTRY: ModelEntry[] = [
  { name: "tiny.en",             filename: "ggml-tiny.en.bin",             sizeMb: 75,   multilingual: false, quantized: false, useCase: "Quick tests, lowest accuracy",                       url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin" },
  { name: "base.en",             filename: "ggml-base.en.bin",             sizeMb: 142,  multilingual: false, quantized: false, useCase: "Fast English, good accuracy",                         url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" },
  { name: "small.en",            filename: "ggml-small.en.bin",            sizeMb: 466,  multilingual: false, quantized: false, useCase: "Better English accuracy",                             url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin" },
  { name: "medium.en",           filename: "ggml-medium.en.bin",           sizeMb: 1500, multilingual: false, quantized: false, useCase: "High accuracy English, fast on GPU",                  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin" },
  { name: "tiny",                filename: "ggml-tiny.bin",                sizeMb: 75,   multilingual: true,  quantized: false, useCase: "Multilingual, minimal accuracy",                      url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" },
  { name: "base",                filename: "ggml-base.bin",                sizeMb: 142,  multilingual: true,  quantized: false, useCase: "Multilingual, fast",                                  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" },
  { name: "small",               filename: "ggml-small.bin",               sizeMb: 466,  multilingual: true,  quantized: false, useCase: "Multilingual, better accuracy",                       url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" },
  { name: "medium",              filename: "ggml-medium.bin",              sizeMb: 1500, multilingual: true,  quantized: false, useCase: "Multilingual, high accuracy",                         url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin" },
  { name: "large-v3",            filename: "ggml-large-v3.bin",            sizeMb: 2900, multilingual: true,  quantized: false, useCase: "Best accuracy, multilingual — requires 6GB+ VRAM",   url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin" },
  { name: "large-v3-turbo",      filename: "ggml-large-v3-turbo.bin",      sizeMb: 1600, multilingual: true,  quantized: false, useCase: "~6x faster than large-v3, minimal accuracy loss — RECOMMENDED for English GPU batch work", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" },
  { name: "small.en-tdrz",       filename: "ggml-small.en-tdrz.bin",       sizeMb: 465,  multilingual: false, quantized: false, useCase: "TinyDiarize — mono speaker-turn detection (English). Use with tinydiarize=true", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-tdrz.bin" },
  { name: "base.en-q5_1",        filename: "ggml-base.en-q5_1.bin",        sizeMb: 57,   multilingual: false, quantized: true,  useCase: "Tiny English model, CPU-friendly",                   url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin" },
  { name: "small.en-q5_1",       filename: "ggml-small.en-q5_1.bin",       sizeMb: 181,  multilingual: false, quantized: true,  useCase: "Fast English, low memory, good for CPU",              url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin" },
  { name: "medium.en-q5_0",      filename: "ggml-medium.en-q5_0.bin",      sizeMb: 514,  multilingual: false, quantized: true,  useCase: "High accuracy English, CPU-friendly — good default for no-GPU systems", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin" },
  { name: "large-v3-q5_0",       filename: "ggml-large-v3-q5_0.bin",       sizeMb: 1080, multilingual: true,  quantized: true,  useCase: "Best multilingual quality at half the size",           url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin" },
  { name: "large-v3-turbo-q5_0", filename: "ggml-large-v3-turbo-q5_0.bin", sizeMb: 547,  multilingual: true,  quantized: true,  useCase: "RECOMMENDED for CPU-only multilingual — fast, low memory, good accuracy", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin" },
  { name: "large-v3-turbo-q8_0", filename: "ggml-large-v3-turbo-q8_0.bin", sizeMb: 874,  multilingual: true,  quantized: true,  useCase: "Turbo quality closer to full precision, moderate size", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin" },
];

const ALLOWED_HF_PREFIXES = [
  "https://huggingface.co/ggerganov/whisper.cpp/",
  "https://huggingface.co/ggml-org/",
];

function hasVulkanDll(): boolean {
  const whisperDir = dirname(WHISPER_CLI_PATH);
  return existsSync(join(whisperDir, "ggml-vulkan.dll"));
}

// ---------------------------------------------------------------------------
// Media analysis
// ---------------------------------------------------------------------------
interface MediaInfo {
  filePath: string;
  fileName: string;
  durationSec: number;
  sizeMb: number;
  codec: string;
  bitrate: number;
}

async function probeFile(filePath: string): Promise<MediaInfo | null> {
  try {
    const { stdout } = await execFileAsync(FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1").replace(/ffmpeg$/i, "ffprobe"), [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });

    const data = JSON.parse(stdout);
    const fmt = data.format ?? {};
    const streams: any[] = data.streams ?? [];
    const audioStream = streams.find((s: any) => s.codec_type === "audio");

    const durationSec = parseFloat(fmt.duration ?? "0") || 0;
    const sizeMb = parseInt(fmt.size ?? "0", 10) / (1024 * 1024);
    const bitrate = Math.round(parseInt(fmt.bit_rate ?? "0", 10) / 1000);
    const codec = audioStream?.codec_name ?? fmt.format_name?.split(",")[0] ?? "unknown";

    return { filePath, fileName: basename(filePath), durationSec, sizeMb, codec, bitrate };
  } catch {
    return null;
  }
}



function padEnd(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function needsConversion(filePath: string): boolean {
  return !NATIVE_EXTENSIONS.includes(extname(filePath).toLowerCase());
}

function isSupportedFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(extname(filePath).toLowerCase());
}

async function convertToWav(inputPath: string): Promise<string> {
  const tmpFile = join(tmpdir(), `whisper_tmp_${Date.now()}_${randomUUID().slice(0, 8)}.wav`);
  await execFileAsync(FFMPEG_PATH, [
    "-y", "-i", inputPath,
    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tmpFile,
  ], { windowsHide: true });
  return tmpFile;
}

// ---------------------------------------------------------------------------
// Whisper CLI options
// ---------------------------------------------------------------------------
interface WhisperOptions {
  language: string;
  outputFormat: OutputFormat;
  threads: number;
  translate?: boolean;
  temperature?: number;
  prompt?: string;
  conditionOnPrevText?: boolean;
  noSpeechThold?: number;
  beamSize?: number;
  bestOf?: number;
  gpuDevice?: number;
  processors?: number;
  maxLen?: number;
  splitOnWord?: boolean;
  wordTimestamps?: boolean;
  diarize?: boolean;
  tinyDiarize?: boolean;
  vadModel?: string;
  offsetT?: number;
  duration?: number;
}

function buildArgs(filePath: string, model: string, opts: WhisperOptions): string[] {
  const lang = opts.language === "auto" ? "auto" : opts.language;
  const args = ["-m", model, "-f", filePath, "-l", lang, "-t", String(opts.threads)];

  if (!opts.conditionOnPrevText) args.push("--max-context", "0");
  args.push("--no-speech-thold", String(opts.noSpeechThold ?? 0.6));

  if (opts.translate) args.push("--translate");
  if (opts.temperature !== undefined) args.push("--temperature", String(opts.temperature));
  if (opts.prompt) args.push("--prompt", opts.prompt);
  if (opts.beamSize !== undefined) args.push("--beam-size", String(opts.beamSize));
  if (opts.bestOf !== undefined) args.push("--best-of", String(opts.bestOf));
  if (opts.gpuDevice !== undefined) args.push("--device", String(opts.gpuDevice));
  if (opts.processors !== undefined && opts.processors > 1) args.push("-p", String(opts.processors));
  if (opts.offsetT !== undefined) args.push("--offset-t", String(opts.offsetT));
  if (opts.duration !== undefined) args.push("--duration", String(opts.duration));
  if (opts.diarize) args.push("--diarize");
  if (opts.tinyDiarize) args.push("--tinydiarize");

  if (opts.wordTimestamps) {
    args.push("--max-len", "1", "--split-on-word");
  } else {
    if (opts.maxLen !== undefined) args.push("--max-len", String(opts.maxLen));
    if (opts.splitOnWord) args.push("--split-on-word");
  }

  if (opts.vadModel && existsSync(opts.vadModel)) {
    args.push("--vad", "--vad-model", opts.vadModel);
  }

  // Output format
  if (opts.outputFormat === "srt") {
    args.push("-osrt", "-of", filePath.replace(/\.[^.]+$/, ""));
  } else if (opts.outputFormat === "vtt") {
    args.push("-ovtt", "-of", filePath.replace(/\.[^.]+$/, ""));
  } else if (opts.outputFormat === "lrc") {
    args.push("-olrc", "-of", filePath.replace(/\.[^.]+$/, ""));
  } else if (opts.outputFormat === "csv") {
    args.push("-ocsv", "-of", filePath.replace(/\.[^.]+$/, ""));
  } else if (opts.outputFormat === "json") {
    args.push("-oj");
  } else if (opts.outputFormat === "text") {
    args.push("--no-timestamps");
  }
  // "timestamps": no flag — whisper default stdout includes timestamps

  return args;
}

async function detectLanguage(wavPath: string, model: string, threads: number, gpuDevice?: number): Promise<string | null> {
  try {
    const dlArgs = [
      "-m", model, "-f", wavPath,
      "-l", "auto",
      "-t", String(threads),
      "--no-timestamps",
      "--duration", "30000",
    ];
    if (gpuDevice !== undefined) dlArgs.push("--device", String(gpuDevice));
    const { stdout, stderr } = await execFileAsync(WHISPER_CLI_PATH, dlArgs, { maxBuffer: 10 * 1024 * 1024, windowsHide: true });
    const output = stdout + stderr;
    const m = output.match(/auto-detected language:\s*([a-z]{2,3})/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Run a single whisper subtitle pass (SRT or VTT) and move the output to dest.
 */
async function runSubtitlePass(
  transcribeFrom: string, dest: string,
  format: "srt" | "vtt",
  model: string, language: string, threads: number,
  translate = false, extraOpts: Partial<WhisperOptions> = {}
): Promise<string> {
  const opts: WhisperOptions = {
    language, outputFormat: format, threads, translate,
    ...extraOpts,
  };
  const args = buildArgs(transcribeFrom, model, opts);
  await execFileAsync(WHISPER_CLI_PATH, args, {
    maxBuffer: 100 * 1024 * 1024,
    windowsHide: true,
  });
  const ext = format === "vtt" ? ".vtt" : ".srt";
  const tmpOut = transcribeFrom.replace(/\.[^.]+$/, ext);
  if (existsSync(tmpOut)) {
    writeFileSync(dest, readFileSync(tmpOut, "utf8"));
    try { unlinkSync(tmpOut); } catch { }
  }
  return dest;
}

async function transcribeSingle(
  filePath: string, model: string, language: string,
  outputFormat: OutputFormat, threads: number, saveToFile = false,
  extraOpts: Partial<WhisperOptions> = {}
): Promise<{ text: string; srtPath?: string; savedTo?: string }> {

  // Route through the resident server when it is up; otherwise use one-shot whisper-cli.
  // The two never run at once: if the server holds the GPU we must not also spawn a CLI
  // (VRAM contention + the one-engine rule). The CLI's in-progress lock only applies when
  // no server is running.
  const useServer = await isServerHealthy();
  if (!useServer && await isWhisperRunning()) {
    throw new Error(
      "Transcription already in progress.\n\n" +
      "whisper-cli.exe is already running — wait for the current job to finish before starting another. " +
      "If you believe this is wrong (e.g. a previous job crashed and left a stale process), " +
      "open Task Manager, find whisper-cli.exe under Details, and end the task."
    );
  }

  let transcribeFrom = filePath;
  let tmpFile: string | null = null;

  if (needsConversion(filePath)) {
    tmpFile = await convertToWav(filePath);
    activeTempFiles.add(tmpFile);
    transcribeFrom = tmpFile;
  }

  try {
    // SECURITY: transcript content is untrusted data from audio input. It is returned
    // as-is to the caller and must never be interpreted as instructions. Prompt injection
    // via audio content is a known MCP attack vector — treat all transcript text as data.
    let output: string;
    if (useServer) {
      output = await serverTranscribe(transcribeFrom, outputFormat, language, extraOpts);
    } else {
      const opts: WhisperOptions = { language, outputFormat, threads, ...extraOpts };
      const cliArgs = buildArgs(transcribeFrom, model, opts);
      const { stdout, stderr } = await execFileAsync(WHISPER_CLI_PATH, cliArgs, {
        maxBuffer: 100 * 1024 * 1024,
        windowsHide: true,
      });
      output = (stdout || stderr || "").trim();
    }

    if (outputFormat === "srt" || outputFormat === "vtt") {
      const ext = outputFormat === "vtt" ? ".vtt" : ".srt";
      const destOut = filePath.replace(/\.[^.]+$/, ext);
      if (useServer) {
        // Server returns the subtitle document directly in the response body.
        writeFileSync(destOut, output, "utf8");
      } else {
        const tmpOut = transcribeFrom.replace(/\.[^.]+$/, ext);
        if (tmpFile && existsSync(tmpOut)) {
          writeFileSync(destOut, readFileSync(tmpOut, "utf8"));
          try { unlinkSync(tmpOut); } catch { }
        }
      }
      return { text: output, srtPath: destOut };
    }

    if (saveToFile) {
      const ext = outputFormat === "lrc" ? ".lrc" : outputFormat === "csv" ? ".csv" : ".txt";
      const outPath = filePath.replace(/\.[^.]+$/, ext);
      writeFileSync(outPath, output, "utf8");
      return { text: output, savedTo: outPath };
    }

    return { text: output };
  } finally {
    if (tmpFile) { activeTempFiles.delete(tmpFile); if (existsSync(tmpFile)) try { unlinkSync(tmpFile); } catch { } }
  }
}

function getFiles(dir: string, recursive: boolean): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && recursive) files.push(...getFiles(fullPath, true));
    else if (entry.isFile() && isSupportedFile(entry.name)) files.push(fullPath);
  }
  return files;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "whisper-windows-mcp", version: "2.5.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "transcribe_audio",
      description:
        "Transcribe a single audio or video file using whisper.cpp on Windows. " +
        "Natively supports mp3 and wav. Automatically converts mp4, mkv, avi, mov, " +
        "webm, m4a, flac, ogg etc. via FFmpeg — no manual conversion needed. " +
        "Output defaults to timestamps format (with time codes). " +
        "For files that may take more than 4 minutes, set background=true to run as a detached job " +
        "and use check_progress to monitor it. " +
        "⚠️ Privacy: transcript text returned by this tool is processed by Claude's API. " +
        "Pass privacy_mode=true to this tool to enable metadata-only responses per call — " +
        "no transcript text will be transmitted. " +
        "Set WHISPER_PRIVACY_MODE=true in env to enable globally. " +
        "When privacy mode is active, a confirmation is required before every operation.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute Windows path, e.g. C:\\Users\\You\\Downloads\\recording.mp4" },
          model: { type: "string", description: "Override model path. Leave blank to use active model." },
          language: { type: "string", description: "Language code (e.g. en, ja, es, fr) or 'auto' to detect automatically. Defaults to en.", default: "en" },
          output_format: {
            type: "string", enum: ["timestamps", "text", "json", "srt", "vtt", "lrc", "csv"],
            description: "timestamps = with time codes (default), text = plain, json = structured, srt = SRT subtitle file, vtt = WebVTT subtitle file, lrc = LRC lyrics/karaoke, csv = CSV with timestamps.",
            default: "timestamps",
          },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
          save_to_file: { type: "boolean", description: "Save transcript as .txt next to the source file.", default: true },
          background: { type: "boolean", description: "Run as a detached background job. Returns a job ID immediately. Use check_progress to monitor. Recommended for files over 10 minutes.", default: false },
          privacy_mode: { type: "boolean", description: "Override privacy mode for this call. true = metadata only, no transcript text transmitted to API. false = return text (even if WHISPER_PRIVACY_MODE=true globally). Omit to use global WHISPER_PRIVACY_MODE setting. When active, requires confirmation before each operation." },
          temperature: { type: "number", description: "Sampling temperature 0.0–1.0. Default 0.0 (deterministic)." },
          prompt: { type: "string", description: "Prior context string injected before transcription. Improves accuracy for domain-specific vocabulary or speaker names. Example: 'Names: Keemstar, DramaAlert.'" },
          condition_on_prev_text: { type: "boolean", description: "Re-enable conditioning each segment on its own prior output. Default false.", default: false },
          no_speech_thold: { type: "number", description: "Confidence threshold below which segments are treated as silence. Default 0.6.", default: 0.6 },
          beam_size: { type: "number", description: "Beam search width. Higher = more accurate but slower. Default 5." },
          best_of: { type: "number", description: "Number of candidate sequences to evaluate. Default 5." },
          gpu_device: { type: "number", description: "GPU/Vulkan device index for multi-GPU systems. Overrides the WHISPER_GPU_DEVICE env default. Check whisper-cli's startup log for the index that lists your target card." },
          processors: { type: "number", description: "Number of parallel processors. Default 1." },
          word_timestamps: { type: "boolean", description: "Output one word per timestamped segment. Useful for clip alignment.", default: false },
          max_segment_length: { type: "number", description: "Maximum segment length in characters." },
          split_on_word: { type: "boolean", description: "Split segments at word boundaries.", default: false },
          diarize: { type: "boolean", description: "Stereo speaker diarization — requires stereo audio with speakers on separate channels.", default: false },
          tinydiarize: { type: "boolean", description: "Mono speaker-turn detection (TinyDiarize). Marks '[SPEAKER_TURN]' at speaker changes on single-channel audio. Requires a tdrz model (small.en-tdrz) — download it with download_model and activate with switch_model first.", default: false },
          vad_model: { type: "string", description: "Absolute path to a Silero VAD model .bin file. Strips silence before transcription." },
          offset_t: { type: "number", description: "Start transcription at this offset in milliseconds." },
          duration: { type: "number", description: "Process only this many milliseconds of audio from offset_t." },
        },
        required: ["file_path"],
      },
    },
    {
      name: "check_progress",
      description:
        "Check the status of a background transcription job started with transcribe_audio (background=true). " +
        "Returns current progress, elapsed time, last processed timestamp, and the transcript when complete. " +
        "Call this repeatedly until the job shows as complete or failed. " +
        "⚠️ Privacy: transcript text returned on completion is processed by Claude's API. " +
        "Pass privacy_mode=true to return metadata only for this check, regardless of how the job was started.",
      inputSchema: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "Job ID returned by transcribe_audio when background=true." },
          privacy_mode: { type: "boolean", description: "Override privacy mode for this check. true = metadata only. Omit to use the setting from when the job was started." },
        },
        required: ["job_id"],
      },
    },
    {
      name: "transcribe_batch",
      description:
        "Transcribe multiple audio/video files in a folder interactively, one file at a time. " +
        "Shows a preview of each transcript and waits for confirmation before continuing. " +
        "Saves each transcript as a .txt file next to its source. " +
        "Files already transcribed (with matching .txt) are shown as done and skipped. " +
        "Supported formats: mp3, wav, mp4, mkv, avi, mov, webm, m4a, flac, ogg. " +
        "NOTE: For large unattended batch jobs, use start_batch instead. " +
        "⚠️ Privacy: transcript previews are processed by Claude's API. " +
        "Pass privacy_mode=true to suppress previews and return metadata only. " +
        "When privacy mode is active, confirmation is required before each file.",
      inputSchema: {
        type: "object",
        properties: {
          folder_path: { type: "string", description: "Absolute Windows path to the folder." },
          file_index: { type: "number", description: "Which file to process (1-based). Omit to list files first." },
          language: { type: "string", description: "Language code. Defaults to en.", default: "en" },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
          recursive: { type: "boolean", description: "Include subfolders. Defaults to false.", default: false },
          output_format: {
            type: "string", enum: ["timestamps", "text"],
            description: "timestamps = with time codes (default), text = plain.",
            default: "timestamps",
          },
          privacy_mode: { type: "boolean", description: "Override privacy mode for this call. When active, requires confirmation before each file and returns metadata only." },
        },
        required: ["folder_path"],
      },
    },
    {
      name: "generate_subtitles",
      description:
        "Generate subtitle files for an audio or video file using whisper.cpp. " +
        "Set language='auto' to detect the spoken language automatically. " +
        "Set translate_to_english=true to also generate an English translation subtitle file. " +
        "Supports SRT and WebVTT (VTT) output formats. " +
        "When both native and translation are requested, two files are saved: one in the original language and one English translation. " +
        "Load SRT in VLC via Subtitle → Add Subtitle File. VTT works in web players and HTML5 video. " +
        "Supports all standard formats plus .3gp and .ts.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute Windows path to the file." },
          language: { type: "string", description: "Language code (e.g. ja, es, fr, de) or 'auto' to detect automatically. Defaults to en.", default: "en" },
          output_format: {
            type: "string", enum: ["srt", "vtt"],
            description: "srt = SubRip subtitle (default, widest compatibility), vtt = WebVTT (web and HTML5 video).",
            default: "srt",
          },
          translate_to_english: {
            type: "boolean",
            description: "Also generate an English translation subtitle file alongside the native language file. Only applies when language is not 'en'. Not available in background mode.",
            default: false,
          },
          background: {
            type: "boolean",
            description: "Run as a detached background job — recommended for files over 10 minutes. Returns a job ID to use with check_progress. translate_to_english is not available in background mode.",
            default: false,
          },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
          temperature: { type: "number", description: "Sampling temperature 0.0–1.0. Default 0.0." },
          prompt: { type: "string", description: "Prior context string for domain-specific vocabulary or speaker names." },
          beam_size: { type: "number", description: "Beam search width. Higher = more accurate, slower. Default 5." },
          best_of: { type: "number", description: "Candidate sequences evaluated. Default 5." },
          diarize: { type: "boolean", description: "Stereo speaker diarization. Requires stereo audio.", default: false },
          tinydiarize: { type: "boolean", description: "Mono speaker-turn detection (TinyDiarize). Requires a tdrz model (small.en-tdrz) activated via switch_model.", default: false },
          vad_model: { type: "string", description: "Path to Silero VAD model .bin. Strips silence before transcription." },
          gpu_device: { type: "number", description: "GPU/Vulkan device index for multi-GPU systems. Overrides the WHISPER_GPU_DEVICE env default. Check whisper-cli's startup log for the index that lists your target card." },
        },
        required: ["file_path"],
      },
    },
    {
      name: "check_config",
      description: "Verify whisper-cli.exe, model, and FFmpeg are all available. Run this first if anything fails.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "start_batch",
      description:
        "Start an automated sequential batch transcription of all untranscribed files in a folder. " +
        "Scans for files without a matching .txt, sorts by duration (shortest first), " +
        "and processes them one at a time as background jobs. " +
        "Each file is validated after completion — empty or suspiciously short outputs are flagged. " +
        "Batch self-advances without polling when each file finishes. " +
        "Returns a batch ID to use with check_batch_progress. " +
        "⚠️ Privacy: when privacy_mode is active, one confirmation is required before the batch starts. " +
        "All files then process unattended. No transcript text is returned to the API.",
      inputSchema: {
        type: "object",
        properties: {
          folder_path: { type: "string", description: "Absolute Windows path to the folder." },
          language: { type: "string", description: "Language code. Defaults to en.", default: "en" },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
          output_format: {
            type: "string", enum: ["timestamps", "text"],
            description: "timestamps = with time codes (default), text = plain. Applies to all files in the batch.",
            default: "timestamps",
          },
          privacy_mode: { type: "boolean", description: "Override privacy mode for this batch. When active, requires one confirmation before batch start. All files process unattended with no transcript text returned." },
        },
        required: ["folder_path"],
      },
    },
    {
      name: "check_batch_progress",
      description:
        "Check the status of a batch started with start_batch. " +
        "Automatically advances to the next file when the current one finishes. " +
        "Returns overall progress, current file, failed files, and elapsed time. " +
        "Call repeatedly until the batch shows as complete.",
      inputSchema: {
        type: "object",
        properties: {
          batch_id: { type: "string", description: "Batch ID returned by start_batch." },
        },
        required: ["batch_id"],
      },
    },
    {
      name: "analyze_media",
      description:
        "Analyze one or more media files using FFprobe before transcribing. " +
        "For a single file: returns duration, size, codec, and estimated transcription time on CPU and GPU. " +
        "For a folder: scans all supported media files and returns a sorted table with the same info for each. " +
        "Use this to plan batch work, estimate how long transcription will take, or check what's already been transcribed.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute Windows path to a single file or a folder." },
          sort_by: {
            type: "string",
            enum: ["duration", "name", "size"],
            description: "For folder scans: sort order. Defaults to duration (shortest first).",
            default: "duration",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "check_system",
      description:
        "Detect GPU hardware and verify Vulkan acceleration is available. " +
        "Reports GPU name, VRAM, whether the Vulkan binary is installed, " +
        "and recommends the best Whisper model for your hardware.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_models",
      description:
        "List all Whisper model files installed in your models directory. " +
        "Shows filename, size, whether it is currently active, quantization status, " +
        "and recommended use case for each model. No network calls — reads local filesystem only.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "download_model",
      description:
        "Download a Whisper model from Hugging Face directly into your models directory. " +
        "Accepts a model name (e.g. large-v3-turbo, medium.en-q5_0) and handles the download automatically. " +
        "Downloads only from trusted Hugging Face namespaces (ggerganov/whisper.cpp and ggml-org). " +
        "After downloading, use switch_model to activate it for the current session.",
      inputSchema: {
        type: "object",
        properties: {
          model_name: { type: "string", description: "Model name to download, e.g. 'large-v3-turbo', 'medium.en-q5_0'. Use list_models to see what is already installed." },
        },
        required: ["model_name"],
      },
    },
    {
      name: "switch_model",
      description:
        "Switch the active Whisper model for the current session without restarting Claude Desktop. " +
        "Accepts a model filename (e.g. ggml-large-v3-turbo.bin) or full path. " +
        "The model must already be installed in your models directory. " +
        "Change is session-scoped — does not persist after Claude Desktop restarts.",
      inputSchema: {
        type: "object",
        properties: {
          model_name: { type: "string", description: "Model filename (e.g. ggml-large-v3-turbo.bin) or full path. Must be a .bin file in the configured models directory." },
        },
        required: ["model_name"],
      },
    },
    {
      name: "whisper_server",
      description:
        "Start, stop, or check the persistent whisper model server. When running, the active model stays " +
        "resident in VRAM and every transcribe_audio / transcribe_batch call is served over localhost without " +
        "reloading it — eliminating the per-file model-load cost (a large speedup for many short files). " +
        "⚠️ The resident model holds GPU VRAM for the server's entire lifetime, so start it deliberately, do your " +
        "work, then stop it to hand the GPU back to other applications. While it is running, background jobs, " +
        "start_batch, generate_subtitles, and lrc/csv or advanced per-call options are refused (they need the " +
        "one-shot CLI and would contend for the GPU) — stop the server to use those. Bound to localhost only.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["start", "stop", "status"],
            description: "start = launch the server with the active model resident; stop = shut it down and free VRAM; status = report whether it is running, the resident model, port, and uptime.",
          },
        },
        required: ["action"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // -------------------------------------------------------------------------
  // check_config
  // -------------------------------------------------------------------------
  if (name === "check_config") {
    const error = validatePaths();
    if (error) return { content: [{ type: "text", text: `❌ Configuration error:\n\n${error}` }], isError: true };

    let ffmpegStatus = "✅ Found";
    try { await execFileAsync(FFMPEG_PATH, ["-version"], { windowsHide: true }); }
    catch { ffmpegStatus = "⚠️  Not found — video/non-MP3 formats require FFmpeg in PATH"; }

    const serverInstalled = existsSync(WHISPER_SERVER_PATH);
    const serverUp = await isServerHealthy();
    const serverStatus = serverUp
      ? `🟢 running (resident, holding VRAM) at ${serverBaseUrl()}`
      : serverInstalled
        ? `off — start with whisper_server action="start" (binary present)`
        : `off — whisper-server.exe not found at ${WHISPER_SERVER_PATH}`;

    return {
      content: [{
        type: "text",
        text:
          `✅ Configuration looks good!\n\n` +
          `whisper-cli: ${WHISPER_CLI_PATH}\n` +
          `Model:       ${WHISPER_MODEL}\n` +
          `Threads:     ${WHISPER_THREADS} of ${SYSTEM_THREADS} logical cores\n` +
          `GPU device:  ${WHISPER_GPU_DEVICE !== undefined ? `--device ${WHISPER_GPU_DEVICE} (WHISPER_GPU_DEVICE)` : "whisper-cli default (device 0)"}\n` +
          `FFmpeg:      ${ffmpegStatus}\n` +
          `Model server: ${serverStatus}\n` +
          `Privacy mode: ${WHISPER_PRIVACY_MODE ? "✅ active (WHISPER_PRIVACY_MODE=true)" : "off"}\n\n` +
          `Optional env vars: WHISPER_THREADS, WHISPER_GPU_DEVICE, WHISPER_FOREGROUND_MAX_SEC, FFMPEG_PATH, WHISPER_SERVER_PATH, WHISPER_SERVER_PORT, WHISPER_PRIVACY_MODE, WHISPER_CONSENT_ACKNOWLEDGED`,
      }],
    };
  }

  // -------------------------------------------------------------------------
  // analyze_media
  // -------------------------------------------------------------------------
  if (name === "analyze_media") {
    const targetPath = args?.path as string;
    const sortBy = (args?.sort_by as string) || "duration";

    if (!targetPath) return { content: [{ type: "text", text: "path is required." }], isError: true };
    const analyzePathError = validateInputPath(targetPath);
    if (analyzePathError) return { content: [{ type: "text", text: analyzePathError }], isError: true };
    if (!existsSync(targetPath)) return { content: [{ type: "text", text: `Path not found: ${targetPath}` }], isError: true };

    const ffprobePath = FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1").replace(/ffmpeg$/i, "ffprobe");
    try {
      await execFileAsync(ffprobePath, ["-version"], { windowsHide: true });
    } catch {
      return {
        content: [{ type: "text", text: "ffprobe not found. FFprobe is bundled with FFmpeg — make sure FFmpeg is installed and in your PATH." }],
        isError: true,
      };
    }

    const vulkan = hasVulkanDll();
    const stat = statSync(targetPath);

    if (stat.isFile()) {
      const info = await probeFile(targetPath);
      if (!info) {
        return { content: [{ type: "text", text: `Could not probe file: ${targetPath}\nMake sure it is a supported media file.` }], isError: true };
      }
      const txtPath = targetPath.replace(/\.[^.]+$/, ".txt");
      const transcribed = existsSync(txtPath) ? "✅ already transcribed" : "⬜ not yet transcribed";

      return {
        content: [{
          type: "text",
          text:
            `📄 ${info.fileName}\n` +
            `${"─".repeat(40)}\n` +
            `Duration:   ${formatDuration(info.durationSec)}\n` +
            `Size:       ${info.sizeMb.toFixed(1)} MB\n` +
            `Codec:      ${info.codec}\n` +
            `Bitrate:    ${info.bitrate} kbps\n` +
            `Status:     ${transcribed}\n\n` +
            `Estimated transcription time:\n` +
            `  CPU:  ${estimateTime(info.durationSec, false)}\n` +
            `  GPU:  ${estimateTime(info.durationSec, true)}${vulkan ? "" : " (⚠️ Vulkan not detected — GPU estimate may not apply)"}`,
        }],
      };
    }

    const files = getFiles(targetPath, false);
    if (files.length === 0) {
      return { content: [{ type: "text", text: `No supported media files found in: ${targetPath}` }], isError: true };
    }

    const results: MediaInfo[] = [];
    for (const f of files) {
      const info = await probeFile(f);
      if (info) results.push(info);
    }

    if (sortBy === "name") results.sort((a, b) => a.fileName.localeCompare(b.fileName));
    else if (sortBy === "size") results.sort((a, b) => a.sizeMb - b.sizeMb);
    else results.sort((a, b) => a.durationSec - b.durationSec);

    const totalDuration = results.reduce((acc, r) => acc + r.durationSec, 0);
    const totalSize = results.reduce((acc, r) => acc + r.sizeMb, 0);
    const transcribedCount = results.filter(r => existsSync(r.filePath.replace(/\.[^.]+$/, ".txt"))).length;

    const header =
      `${padEnd("File", 36)} ${padEnd("Duration", 8)} ${padEnd("Size", 8)} ${padEnd("CPU est", 8)} ${padEnd("GPU est", 8)} Status\n` +
      `${"─".repeat(90)}\n`;

    const rows = results.map(r => {
      const done = existsSync(r.filePath.replace(/\.[^.]+$/, ".txt")) ? "✅" : "⬜";
      return (
        `${padEnd(r.fileName, 36)} ` +
        `${padEnd(formatDuration(r.durationSec), 8)} ` +
        `${padEnd(r.sizeMb.toFixed(1) + " MB", 8)} ` +
        `${padEnd(estimateTime(r.durationSec, false), 8)} ` +
        `${padEnd(estimateTime(r.durationSec, true), 8)} ` +
        done
      );
    }).join("\n");

    const summary =
      `\n${"─".repeat(90)}\n` +
      `${results.length} files | Total duration: ${formatDuration(totalDuration)} | Total size: ${totalSize.toFixed(1)} MB\n` +
      `Transcribed: ${transcribedCount}/${results.length}\n` +
      `Total est. CPU time: ${estimateTime(totalDuration, false)} | Total est. GPU time: ${estimateTime(totalDuration, true)}` +
      (vulkan ? "" : "\n⚠️  ggml-vulkan.dll not detected — GPU estimates may not apply");

    return {
      content: [{
        type: "text",
        text: `Media analysis: ${targetPath}\n\n${header}${rows}${summary}`,
      }],
    };
  }

  // -------------------------------------------------------------------------
  // check_system
  // -------------------------------------------------------------------------
  if (name === "check_system") {
    const vulkan = hasVulkanDll();
    const gpus = await detectGpus();

    let gpuLines = "";
    if (gpus.length === 0) {
      gpuLines = "ℹ️  GPU name unavailable (wmic returned nothing — it is deprecated/removed on Windows 11 24H2+). This does NOT mean acceleration is off; the Vulkan check below determines actual GPU use.\n";
    } else {
      for (const gpu of gpus) {
        const vramStr = formatVram(gpu.vramBytes);
        gpuLines += `🖥️  GPU:   ${gpu.name}\n`;
        gpuLines += `💾  VRAM:  ${vramStr} (reported by Windows — may be half of actual on AMD cards)\n`;
        if (gpu.vramBytes > 0) {
          gpuLines += `📦  Recommended model: ${recommendedModel(gpu.vramBytes)}\n`;
        }
        gpuLines += "\n";
      }
    }

    const vulkanLine = vulkan
      ? `✅ Vulkan binary:  ggml-vulkan.dll found — GPU acceleration is active`
      : `❌ Vulkan binary:  ggml-vulkan.dll NOT found — whisper is running CPU-only\n\n` +
        `   To enable GPU acceleration:\n` +
        `   Download whisper-vulkan-win-x64.zip from:\n` +
        `   https://github.com/eviscerations/whisper-windows-mcp/releases\n` +
        `   Extract to: ${dirname(WHISPER_CLI_PATH)}`;

    return {
      content: [{
        type: "text",
        text: `System check\n${"─".repeat(40)}\n\n${gpuLines}${vulkanLine}`,
      }],
    };
  }

  // -------------------------------------------------------------------------
  // list_models
  // -------------------------------------------------------------------------
  if (name === "list_models") {
    const modelsDir = dirname(WHISPER_MODEL);
    if (!existsSync(modelsDir)) {
      return { content: [{ type: "text", text: `Models directory not found: ${modelsDir}` }], isError: true };
    }

    let files: string[];
    try {
      files = readdirSync(modelsDir).filter(f => f.endsWith(".bin"));
    } catch (err: any) {
      return { content: [{ type: "text", text: `Could not read models directory: ${err?.message}` }], isError: true };
    }

    if (files.length === 0) {
      return {
        content: [{
          type: "text",
          text:
            `No .bin model files found in: ${modelsDir}\n\n` +
            `Use download_model to install a model.\n` +
            `Recommended starting point: large-v3-turbo (English GPU) or large-v3-turbo-q5_0 (CPU/multilingual)`,
        }],
      };
    }

    const activeFile = basename(WHISPER_MODEL);
    const rows = files.map(f => {
      const fullPath = join(modelsDir, f);
      const sizeMb = (() => { try { return (statSync(fullPath).size / (1024 * 1024)).toFixed(0) + " MB"; } catch { return "?"; } })();
      const isActive = f === activeFile ? " ◀ ACTIVE" : "";
      const known = MODEL_REGISTRY.find(m => m.filename === f);
      const quantTag = known?.quantized ? " [quantized]" : "";
      const useCase = known ? known.useCase : "Unknown model";
      return `${isActive ? "●" : "○"} ${f}${isActive}${quantTag}\n  Size: ${sizeMb}  |  ${useCase}`;
    });

    const installedFilenames = new Set(files);
    const available = MODEL_REGISTRY
      .filter(m => !installedFilenames.has(m.filename))
      .map(m => `  ${m.name} (${m.filename}, ~${m.sizeMb} MB) — ${m.useCase}`)
      .join("\n");

    return {
      content: [{
        type: "text",
        text:
          `Installed models in: ${modelsDir}\n${"─".repeat(60)}\n\n` +
          rows.join("\n\n") +
          (available
            ? `\n\n${"─".repeat(60)}\nAvailable to download:\n${available}\n\nUse download_model <name> to install.`
            : `\n\n${"─".repeat(60)}\nAll known models are installed.`),
      }],
    };
  }

  // -------------------------------------------------------------------------
  // download_model
  // -------------------------------------------------------------------------
  if (name === "download_model") {
    const modelName = (args?.model_name as string)?.trim();
    if (!modelName) return { content: [{ type: "text", text: "model_name is required." }], isError: true };

    const entry = MODEL_REGISTRY.find(
      m => m.name === modelName || m.filename === modelName
    );
    if (!entry) {
      const names = MODEL_REGISTRY.map(m => m.name).join(", ");
      return {
        content: [{
          type: "text",
          text:
            `Unknown model: "${modelName}"\n\n` +
            `Available models:\n${names}\n\n` +
            `Use list_models to see what is already installed.`,
        }],
        isError: true,
      };
    }

    const urlOk = ALLOWED_HF_PREFIXES.some(prefix => entry.url.startsWith(prefix));
    if (!urlOk) {
      return {
        content: [{ type: "text", text: `Security error: download URL for "${modelName}" is not in the allowed list.` }],
        isError: true,
      };
    }

    const modelsDir = dirname(WHISPER_MODEL);
    if (!existsSync(modelsDir)) {
      try { mkdirSync(modelsDir, { recursive: true }); } catch (err: any) {
        return { content: [{ type: "text", text: `Could not create models directory: ${err?.message}` }], isError: true };
      }
    }

    const destPath = join(modelsDir, entry.filename);
    if (existsSync(destPath)) {
      const sizeMb = (statSync(destPath).size / (1024 * 1024)).toFixed(0);
      return {
        content: [{
          type: "text",
          text:
            `✅ ${entry.filename} is already installed (${sizeMb} MB).\n\n` +
            `Use switch_model ${entry.filename} to activate it.`,
        }],
      };
    }

    try {
      const https = await import("https");
      const fs = await import("fs");

      await new Promise<void>((resolve, reject) => {
        const tmpPath = destPath + ".part";
        const file = fs.createWriteStream(tmpPath);

        function doRequest(url: string) {
          https.get(url, (res) => {
            if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
              const redirectUrl = res.headers.location;
              const redirectOk = ALLOWED_HF_PREFIXES.some(p => redirectUrl.startsWith(p))
                || redirectUrl.startsWith("https://cdn-lfs.huggingface.co/")
                || redirectUrl.startsWith("https://cdn-lfs-us-1.huggingface.co/");
              if (!redirectOk) { reject(new Error(`Redirect to disallowed URL: ${redirectUrl}`)); return; }
              doRequest(redirectUrl);
              return;
            }
            if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} from ${url}`)); return; }
            res.pipe(file);
            file.on("finish", () => {
              file.close((closeErr) => {
                if (closeErr) { reject(closeErr); return; }
                // Integrity: if the server declared a Content-Length, reject a short/truncated
                // download (dropped connection) BEFORE promoting .part → final, so a partial
                // file can never become the "installed" model. (Full SHA256 verification is a
                // separate follow-up requiring verified per-model digests.)
                const expectedLen = parseInt(res.headers["content-length"] ?? "", 10);
                let actualLen = 0;
                try { actualLen = fs.statSync(tmpPath).size; } catch { }
                if (Number.isFinite(expectedLen) && expectedLen > 0 && actualLen !== expectedLen) {
                  try { fs.unlinkSync(tmpPath); } catch { }
                  reject(new Error(`Incomplete download: wrote ${actualLen} of ${expectedLen} bytes (connection dropped?). Re-run download_model to retry.`));
                  return;
                }
                try {
                  fs.renameSync(tmpPath, destPath);
                  resolve();
                } catch (renameErr) {
                  reject(renameErr);
                }
              });
            });
          }).on("error", (err) => {
            try { fs.unlinkSync(tmpPath); } catch { }
            reject(err);
          });
        }

        doRequest(entry.url);
      });

      const finalSizeMb = (statSync(destPath).size / (1024 * 1024)).toFixed(0);
      return {
        content: [{
          type: "text",
          text:
            `✅ Downloaded: ${entry.filename} (${finalSizeMb} MB)\n` +
            `Saved to: ${destPath}\n\n` +
            `Use switch_model ${entry.filename} to activate it for this session.`,
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Download failed:\n\n${err?.message || String(err)}` }],
        isError: true,
      };
    }
  }

  // -------------------------------------------------------------------------
  // switch_model
  // -------------------------------------------------------------------------
  if (name === "switch_model") {
    const modelInput = (args?.model_name as string)?.trim();
    if (!modelInput) return { content: [{ type: "text", text: "model_name is required." }], isError: true };

    const resolved = resolveModelPath(modelInput);
    if ("error" in resolved) {
      return { content: [{ type: "text", text: resolved.error }], isError: true };
    }
    const resolvedPath = resolved.path;

    if (await isWhisperRunning()) {
      return {
        content: [{ type: "text", text: "Cannot switch model while a transcription is in progress. Wait for the current job to finish first." }],
        isError: true,
      };
    }

    const previousModel = basename(WHISPER_MODEL);
    WHISPER_MODEL = resolvedPath;
    const newModel = basename(WHISPER_MODEL);
    const sizeMb = (statSync(resolvedPath).size / (1024 * 1024)).toFixed(0);
    const known = MODEL_REGISTRY.find(m => m.filename === newModel);

    // If the resident server is up, hot-swap its model in place (POST /load) so the switch
    // takes effect without a restart. Falls back to a warning if the reload call fails.
    let serverNote = "";
    if (await isServerHealthy()) {
      try {
        await serverLoadModel(resolvedPath);
        serverModel = resolvedPath;
        serverNote = `\nResident server: reloaded to ${newModel} (no restart needed).`;
      } catch (e: any) {
        serverNote = `\n⚠️ Resident server is running but the hot-swap failed (${e?.message || e}). Restart it with whisper_server action="stop" then "start".`;
      }
    }

    return {
      content: [{
        type: "text",
        text:
          `✅ Model switched!\n\n` +
          `Previous: ${previousModel}\n` +
          `Active:   ${newModel} (${sizeMb} MB)\n` +
          (known ? `Use case: ${known.useCase}\n` : "") +
          serverNote +
          `\nThis change is session-scoped. To make it permanent, update WHISPER_MODEL in claude_desktop_config.json.`,
      }],
    };
  }

  // -------------------------------------------------------------------------
  // whisper_server — start / stop / status of the resident model server
  // -------------------------------------------------------------------------
  if (name === "whisper_server") {
    const action = (args?.action as string) || "";

    if (action === "status") {
      const up = await isServerHealthy();
      if (!up) {
        const orphan = await isServerProcessRunning();
        return { content: [{ type: "text", text:
          `Resident model server: ⚪ not running.${orphan ? "\n\n⚠️ A whisper-server.exe process exists but isn't answering on the configured port — it may be starting up or stuck. Try whisper_server action=\"stop\"." : ""}\n\n` +
          `Start it with whisper_server action="start" to keep the model resident and skip the per-file reload cost.` }] };
      }
      const uptime = serverStartedAt ? formatDuration(Math.round((Date.now() - serverStartedAt) / 1000)) : "unknown";
      return { content: [{ type: "text", text:
        `Resident model server: 🟢 running (holding VRAM).\n\n` +
        `Model:   ${basename(serverModel ?? WHISPER_MODEL)}\n` +
        `Address: ${serverBaseUrl()} (localhost only)\n` +
        `Uptime:  ${uptime}\n\n` +
        `transcribe_audio / transcribe_batch are served here with no model reload. ` +
        `Stop it with whisper_server action="stop" to free the GPU for other apps.` }] };
    }

    if (action === "stop") {
      const wasUp = await isServerHealthy() || await isServerProcessRunning();
      if (serverChild && !serverChild.killed) {
        try { serverChild.kill(); } catch { /* fall through to taskkill */ }
      }
      // Backstop: kill any lingering whisper-server.exe (e.g. an orphan we didn't spawn) so
      // VRAM is actually released — the whole point of stopping.
      try { await execFileAsync(join(SYSTEM_ROOT, "System32", "taskkill.exe"), ["/F", "/IM", "whisper-server.exe"], { windowsHide: true }); } catch { /* none running */ }
      serverChild = null; serverModel = null; serverStartedAt = 0;
      return { content: [{ type: "text", text: wasUp
        ? `🛑 Resident model server stopped. VRAM released — the GPU is free for other applications.`
        : `Resident model server was not running. Nothing to stop.` }] };
    }

    if (action === "start") {
      if (await isServerHealthy()) {
        return { content: [{ type: "text", text: `Resident model server is already running at ${serverBaseUrl()} with ${basename(serverModel ?? WHISPER_MODEL)}. Use action="status" for details.` }] };
      }
      const cfgErr = validatePaths();
      if (cfgErr) return { content: [{ type: "text", text: cfgErr }], isError: true };
      if (!existsSync(WHISPER_SERVER_PATH)) {
        return { content: [{ type: "text", text:
          `whisper-server.exe not found at: ${WHISPER_SERVER_PATH}\n` +
          `It ships alongside whisper-cli.exe in the whisper.cpp build. Set WHISPER_SERVER_PATH if it lives elsewhere.` }], isError: true };
      }
      // A one-shot CLI job holds the GPU too — don't start a competing resident server.
      if (await isWhisperRunning()) {
        return { content: [{ type: "text", text: "A one-shot whisper-cli transcription is currently running. Wait for it to finish before starting the resident server." }], isError: true };
      }
      // Also clear any stale orphan that isn't answering, so the port is free.
      if (await isServerProcessRunning()) {
        try { await execFileAsync(join(SYSTEM_ROOT, "System32", "taskkill.exe"), ["/F", "/IM", "whisper-server.exe"], { windowsHide: true }); } catch { /* ignore */ }
      }

      const serverArgs = [
        "--host", WHISPER_SERVER_HOST,
        "--port", String(WHISPER_SERVER_PORT),
        "-m", WHISPER_MODEL,
        "-t", String(WHISPER_THREADS),
      ];
      if (WHISPER_GPU_DEVICE !== undefined) serverArgs.push("--device", String(WHISPER_GPU_DEVICE));

      try {
        const child = spawn(WHISPER_SERVER_PATH, serverArgs, { detached: false, stdio: "ignore", windowsHide: true });
        child.on("error", () => { /* surfaced via the readiness check below */ });
        serverChild = child;
        // Model load into VRAM can take a while on a constrained card; wait generously.
        const ready = await waitForServer(180_000);
        if (!ready) {
          try { child.kill(); } catch { }
          try { await execFileAsync(join(SYSTEM_ROOT, "System32", "taskkill.exe"), ["/F", "/IM", "whisper-server.exe"], { windowsHide: true }); } catch { }
          serverChild = null;
          return { content: [{ type: "text", text:
            `Server did not become ready within 180s. The model may be too large for available VRAM, or the binary failed to start.\n` +
            `Model: ${basename(WHISPER_MODEL)}  Port: ${WHISPER_SERVER_PORT}` }], isError: true };
        }
        serverModel = WHISPER_MODEL;
        serverStartedAt = Date.now();
        return { content: [{ type: "text", text:
          `🟢 Resident model server started.\n\n` +
          `Model:   ${basename(WHISPER_MODEL)}\n` +
          `Address: ${serverBaseUrl()} (localhost only)\n\n` +
          `The model is now held in VRAM. transcribe_audio / transcribe_batch will use it with no per-file reload.\n` +
          `⚠️ It keeps the GPU occupied until you run whisper_server action="stop".` }] };
      } catch (err: any) {
        serverChild = null;
        return { content: [{ type: "text", text: `Failed to start whisper-server:\n\n${err?.message || String(err)}` }], isError: true };
      }
    }

    return { content: [{ type: "text", text: `Unknown action: "${action}". Use "start", "stop", or "status".` }], isError: true };
  }

  // -------------------------------------------------------------------------
  // transcribe_audio
  // -------------------------------------------------------------------------
  if (name === "transcribe_audio") {
    const filePath = args?.file_path as string;
    // A user-supplied model override must satisfy the same models-directory containment
    // as switch_model — otherwise it becomes a trivial way to feed whisper-cli an
    // arbitrary file as its model, bypassing the containment guarantee entirely.
    let model = WHISPER_MODEL;
    if (args?.model) {
      const resolvedModel = resolveModelPath(String(args.model));
      if ("error" in resolvedModel) {
        return { content: [{ type: "text", text: resolvedModel.error }], isError: true };
      }
      model = resolvedModel.path;
    }
    const language = (args?.language as string) || "en";
    const outputFormat = ((args?.output_format as string) || "timestamps") as OutputFormat;
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));
    const saveToFile = (args?.save_to_file as boolean) ?? true;
    const background = (args?.background as boolean) || false;

    // Effective privacy mode: per-call param wins over global env var
    const privacyModeParam = args?.privacy_mode as boolean | undefined;
    const effectivePrivacyMode = privacyModeParam ?? WHISPER_PRIVACY_MODE;

    // v2.3.0 quality and control params
    const extraOpts: Partial<WhisperOptions> = {};
    if (args?.temperature !== undefined) extraOpts.temperature = coerceNum(args.temperature);
    if (args?.prompt) extraOpts.prompt = String(args.prompt);
    if (args?.condition_on_prev_text !== undefined) extraOpts.conditionOnPrevText = Boolean(args.condition_on_prev_text);
    if (args?.no_speech_thold !== undefined) extraOpts.noSpeechThold = coerceNum(args.no_speech_thold);
    if (args?.beam_size !== undefined) extraOpts.beamSize = coerceNum(args.beam_size);
    if (args?.best_of !== undefined) extraOpts.bestOf = coerceNum(args.best_of);
    { const g = resolveGpuDevice(args?.gpu_device); if (g !== undefined) extraOpts.gpuDevice = g; }
    if (args?.processors !== undefined) extraOpts.processors = coerceNum(args.processors);
    if (args?.word_timestamps) extraOpts.wordTimestamps = true;
    if (args?.max_segment_length !== undefined) extraOpts.maxLen = coerceNum(args.max_segment_length);
    if (args?.split_on_word) extraOpts.splitOnWord = true;
    if (args?.diarize) extraOpts.diarize = true;
    if (args?.tinydiarize) extraOpts.tinyDiarize = true;
    if (args?.vad_model) {
      const vadPath = String(args.vad_model);
      if (UNSAFE_PATH_RE.test(vadPath)) {
        return { content: [{ type: "text", text: `Invalid vad_model path: "${vadPath}"\nPaths containing ".." or UNC paths are not allowed.` }], isError: true };
      }
      extraOpts.vadModel = vadPath;
    }
    if (args?.offset_t !== undefined) extraOpts.offsetT = coerceNum(args.offset_t);
    if (args?.duration !== undefined) extraOpts.duration = coerceNum(args.duration);

    if (!filePath) return { content: [{ type: "text", text: "file_path is required." }], isError: true };
    const pathError = validateInputPath(filePath);
    if (pathError) return { content: [{ type: "text", text: pathError }], isError: true };
    if (!existsSync(filePath)) return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };

    // Resident-server routing (Phase 1): only the blocking transcribe path is server-backed.
    // Anything else would need one-shot whisper-cli and collide with the server on the GPU,
    // and unsupported options would be silently dropped — so refuse with clear guidance.
    const serverUp = await isServerHealthy();
    if (serverUp) {
      if (background) return serverBusyRefusal("background transcription");
      if (outputFormat === "lrc" || outputFormat === "csv") {
        return { content: [{ type: "text", text:
          `⛔ The resident model server doesn't produce ${outputFormat.toUpperCase()} output. ` +
          `Stop it (whisper_server action="stop") to use the one-shot CLI for ${outputFormat.toUpperCase()}, ` +
          `or choose text / timestamps / srt / vtt / json.` }], isError: true };
      }
      const dropped = unsupportedServerOpts(extraOpts);
      if (dropped.length) {
        return { content: [{ type: "text", text:
          `⛔ These options aren't honored by the resident server and would be silently ignored: ${dropped.join(", ")}.\n\n` +
          `Stop the server (whisper_server action="stop") to run this through the one-shot CLI, or drop those options.` }], isError: true };
      }
    }

    // Background mode — detached process, returns immediately
    if (background) {
      // Privacy mode: gate fires BEFORE spawning. No audio processes until confirmed.
      // Non-privacy mode: consent gate is intentionally deferred to check_progress.
      // At this point no transcript exists yet — there is nothing to gate. The gate
      // fires at check_progress completion when transcript text would first be returned
      // to the API. Audio processing begins immediately after this point in non-privacy mode.
      if (effectivePrivacyMode && checkPrivacyGate(opKeyFor(name, args))) {
        return { content: [{ type: "text", text: privacyGateBlock() }] };
      }

      if (await isWhisperRunning()) {
        return {
          content: [{ type: "text", text: "Transcription already in progress. Wait for the current job to finish before starting another." }],
          isError: true,
        };
      }

      try {
        const bgFormat: BackgroundFormat = outputFormat === "json" ? "text" : outputFormat as BackgroundFormat;
        const { jobId, pid } = await spawnDetached(
          filePath, model, language, threads, bgFormat, extraOpts, undefined, effectivePrivacyMode
        );
        return {
          content: [{
            type: "text",
            text:
              `⏳ Background transcription started.\n\n` +
              `Source: ${basename(filePath)}\n` +
              `Job ID: ${jobId}\n` +
              `PID: ${pid}\n` +
              (effectivePrivacyMode ? `Privacy mode: active — metadata only will be returned\n` : "") +
              `\nCall check_progress with job_id="${jobId}" to monitor progress.\n` +
              `Output will be saved to: ${filePath.replace(/\.[^.]+$/, ".txt")}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed to start background job:\n\n${err?.message || String(err)}` }], isError: true };
      }
    }

    // Foreground timeout guard: a long file blows Claude Desktop's ~4-min MCP timeout in blocking
    // mode (the call errors even though the transcript finishes on disk). Probe the duration and
    // route to background BEFORE running into the wall. Skipped when ffprobe can't read the file
    // (probe returns null) — it never blocks a transcribe it cannot measure. Also skipped in
    // server mode: the model is already resident, so the ~110s reload that drives the estimate
    // past the wall isn't paid.
    if (!serverUp) {
      const info = await probeFile(filePath);
      if (info && estimateSec(info.durationSec, hasVulkanDll()) > FOREGROUND_MAX_SEC) {
        return { content: [{ type: "text", text:
          `⏱️  "${basename(filePath)}" is ~${formatDuration(info.durationSec)} long — a foreground transcription is estimated around ${estimateTime(info.durationSec, hasVulkanDll())}, which would likely exceed Claude Desktop's 4-minute tool timeout (the transcript would still finish on disk, but this call would error out first).\n\n` +
          `Run it in the background instead — returns a job ID immediately, then poll check_progress:\n` +
          `  transcribe_audio with file_path="${filePath}" and background=true\n\n` +
          `(Shorter files still run inline. Adjust the cutoff with WHISPER_FOREGROUND_MAX_SEC.)` }] };
      }
    }

    // Blocking mode (default)
    if (effectivePrivacyMode) {
      // Privacy mode: gate fires before every operation.
      if (checkPrivacyGate(opKeyFor(name, args))) {
        return { content: [{ type: "text", text: privacyGateBlock() }] };
      }
      // Gate passed — proceed to transcription, return metadata only.
    } else {
      // Non-privacy mode: session consent gate fires once before first transcript return.
      // Nothing is processed until user confirms.
      const policy = transcriptPolicy();
      if (policy === "consent_gate") {
        return { content: [{ type: "text", text: consentGateBlock() }] };
      }
    }

    try {
      const result = await transcribeSingle(filePath, model, language, outputFormat, threads, saveToFile, extraOpts);

      if (effectivePrivacyMode) {
        const savedPath = result.savedTo ?? filePath.replace(/\.[^.]+$/, ".txt");
        if (!result.savedTo && outputFormat !== "srt" && outputFormat !== "vtt" && outputFormat !== "json") {
          try { writeFileSync(savedPath, result.text, "utf8"); } catch { }
        }
        const displayPath = result.srtPath ?? result.savedTo ?? savedPath;
        return { content: [{ type: "text", text: privacyModeBlock(basename(filePath), displayPath, result.text) }] };
      }

      // allow — return transcript normally
      let response = result.text;
      if (result.savedTo) response += `\n\n[Transcript saved to: ${result.savedTo}]`;
      if (result.srtPath) response += `\n\n[Subtitle file saved to: ${result.srtPath}]`;
      return { content: [{ type: "text", text: response }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Transcription failed:\n\n${err?.stderr || err?.message || String(err)}` }], isError: true };
    }
  }

  // -------------------------------------------------------------------------
  // check_progress
  // -------------------------------------------------------------------------
  if (name === "check_progress") {
    const jobId = args?.job_id as string;
    const privacyModeParam = args?.privacy_mode as boolean | undefined;
    if (!jobId) return { content: [{ type: "text", text: "job_id is required." }], isError: true };
    if (!isValidJobId(jobId)) {
      return { content: [{ type: "text", text: `Invalid job_id: "${jobId}"\nExpected the ID returned by transcribe_audio (e.g. job_1700000000000_a1b2c3d4).` }], isError: true };
    }
    try {
      const result = await readJobProgress(jobId, privacyModeParam);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error reading job progress:\n\n${err?.message || String(err)}` }], isError: true };
    }
  }

  // -------------------------------------------------------------------------
  // start_batch
  // -------------------------------------------------------------------------
  if (name === "start_batch") {
    const folderPath = args?.folder_path as string;
    const language = (args?.language as string) || "en";
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));
    const outputFormat = ((args?.output_format as string) || "timestamps") as OutputFormat;

    const privacyModeParam = args?.privacy_mode as boolean | undefined;
    const effectivePrivacyMode = privacyModeParam ?? WHISPER_PRIVACY_MODE;

    if (!folderPath) return { content: [{ type: "text", text: "folder_path is required." }], isError: true };
    const pathError = validateInputPath(folderPath);
    if (pathError) return { content: [{ type: "text", text: pathError }], isError: true };
    if (!existsSync(folderPath)) return { content: [{ type: "text", text: `Folder not found: ${folderPath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };

    // Batch runs one-shot detached CLI jobs — refuse while the resident server holds the GPU.
    if (await isServerHealthy()) return serverBusyRefusal("automated batch transcription");

    // Privacy gate: fires once before batch starts. All files then process unattended.
    // Gating per-file in an unattended batch would defeat the purpose of start_batch.
    if (effectivePrivacyMode && checkPrivacyGate(opKeyFor(name, args))) {
      return { content: [{ type: "text", text: privacyGateBlock() }] };
    }

    if (await isWhisperRunning()) {
      return { content: [{ type: "text", text: "A transcription is already running. Wait for it to finish before starting a batch." }], isError: true };
    }

    const allFiles = getFiles(folderPath, false);
    const untranscribed = allFiles.filter(f => !existsSync(f.replace(/\.[^.]+$/, ".txt")));

    if (untranscribed.length === 0) {
      return { content: [{ type: "text", text: `✅ All files in ${folderPath} are already transcribed. Nothing to do.` }] };
    }

    const batchFiles: BatchFile[] = [];
    for (const f of untranscribed) {
      const info = await probeFile(f);
      batchFiles.push({
        filePath: f,
        fileName: basename(f),
        durationSec: info?.durationSec ?? 0,
        status: "pending",
      });
    }
    batchFiles.sort((a, b) => a.durationSec - b.durationSec);

    ensureJobsDir();
    const batchId = `batch_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const batchPath = join(JOBS_DIR, `${batchId}.batch.json`);

    const state: BatchState = {
      batchId,
      batchPath,
      folder: folderPath,
      startTime: new Date().toISOString(),
      files: batchFiles,
      currentIndex: 0,
      status: "running",
      model: WHISPER_MODEL,
      language,
      threads,
      outputFormat,
      privacyMode: effectivePrivacyMode,
    };

    writeJsonAtomic(batchPath, state);
    await spawnNextBatchJob(state);

    const totalDuration = batchFiles.reduce((acc, f) => acc + f.durationSec, 0);

    return {
      content: [{
        type: "text",
        text:
          `⏳ Batch started!\n\n` +
          `Batch ID: ${batchId}\n` +
          `Folder: ${folderPath}\n` +
          `Files to process: ${batchFiles.length}\n` +
          `Total audio: ${formatDuration(totalDuration)}\n` +
          `Est. GPU time: ${estimateTime(totalDuration, hasVulkanDll())}\n` +
          (effectivePrivacyMode ? `Privacy mode: active — metadata only will be returned\n` : "") +
          `\nFirst file: ${batchFiles[0].fileName}\n\n` +
          `Call check_batch_progress with batch_id="${batchId}" to monitor.`,
      }],
    };
  }

  // -------------------------------------------------------------------------
  // check_batch_progress
  // -------------------------------------------------------------------------
  if (name === "check_batch_progress") {
    const batchId = args?.batch_id as string;
    if (!batchId) return { content: [{ type: "text", text: "batch_id is required." }], isError: true };
    if (!isValidBatchId(batchId)) {
      return { content: [{ type: "text", text: `Invalid batch_id: "${batchId}"\nExpected the ID returned by start_batch (e.g. batch_1700000000000_a1b2c3d4).` }], isError: true };
    }
    try {
      const result = await readBatchProgress(batchId);
      return { content: [{ type: "text", text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error reading batch progress:\n\n${err?.message || String(err)}` }], isError: true };
    }
  }

  // -------------------------------------------------------------------------
  // generate_subtitles
  // -------------------------------------------------------------------------
  if (name === "generate_subtitles") {
    const filePath = args?.file_path as string;
    const language = (args?.language as string) || "en";
    const subtitleFormat = ((args?.output_format as string) || "srt") as "srt" | "vtt";
    const translateToEnglish = (args?.translate_to_english as boolean) || false;
    const background = (args?.background as boolean) || false;
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));

    // v2.3.0 quality params
    const extraOpts: Partial<WhisperOptions> = {};
    if (args?.temperature !== undefined) extraOpts.temperature = coerceNum(args.temperature);
    if (args?.prompt) extraOpts.prompt = String(args.prompt);
    if (args?.beam_size !== undefined) extraOpts.beamSize = coerceNum(args.beam_size);
    if (args?.best_of !== undefined) extraOpts.bestOf = coerceNum(args.best_of);
    if (args?.diarize) extraOpts.diarize = true;
    if (args?.tinydiarize) extraOpts.tinyDiarize = true;
    if (args?.vad_model) {
      const vadPath = String(args.vad_model);
      if (UNSAFE_PATH_RE.test(vadPath)) {
        return { content: [{ type: "text", text: `Invalid vad_model path: "${vadPath}"\nPaths containing ".." or UNC paths are not allowed.` }], isError: true };
      }
      extraOpts.vadModel = vadPath;
    }
    { const g = resolveGpuDevice(args?.gpu_device); if (g !== undefined) extraOpts.gpuDevice = g; }

    if (!filePath) return { content: [{ type: "text", text: "file_path is required." }], isError: true };
    const pathError = validateInputPath(filePath);
    if (pathError) return { content: [{ type: "text", text: pathError }], isError: true };
    if (!existsSync(filePath)) return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };
    // Subtitle generation runs one-shot CLI passes (auto-detect + native + translation) —
    // refuse while the resident server holds the GPU. (Server-backed subtitles: later release.)
    if (await isServerHealthy()) return serverBusyRefusal("subtitle generation");
    if (await isWhisperRunning()) {
      return { content: [{ type: "text", text: "Transcription already in progress. Wait for it to finish first." }], isError: true };
    }

    if (background) {
      try {
        const { jobId, pid } = await spawnDetached(filePath, WHISPER_MODEL, language, threads, subtitleFormat, extraOpts);
        return {
          content: [{
            type: "text",
            text:
              `⏳ Background subtitle generation started.\n\n` +
              `Source: ${basename(filePath)}\n` +
              `Job ID: ${jobId}\n` +
              `PID: ${pid}\n` +
              `Format: ${subtitleFormat.toUpperCase()}\n` +
              `Language: ${language}\n\n` +
              `Call check_progress with job_id="${jobId}" to monitor.\n` +
              `Note: translate_to_english is not available in background mode. ` +
              `Run generate_subtitles again after completion to create the English translation.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed to start background subtitle job:\n\n${err?.message || String(err)}` }], isError: true };
      }
    }

    // Foreground timeout guard (same as transcribe_audio): subtitle generation runs MULTIPLE
    // whisper passes inline (auto-detect + native + optional translation), so a long file is even
    // more likely to blow the 4-min MCP timeout. Route to background before running into the wall.
    {
      const info = await probeFile(filePath);
      if (info && estimateSec(info.durationSec, hasVulkanDll()) > FOREGROUND_MAX_SEC) {
        return { content: [{ type: "text", text:
          `⏱️  "${basename(filePath)}" is ~${formatDuration(info.durationSec)} long — foreground subtitle generation (estimated ~${estimateTime(info.durationSec, hasVulkanDll())}, plus extra passes for auto-detect/translation) would likely exceed Claude Desktop's 4-minute tool timeout.\n\n` +
          `Run it in the background instead:\n` +
          `  generate_subtitles with file_path="${filePath}" and background=true\n\n` +
          `(translate_to_english isn't available in background mode — run a second pass after it completes. Adjust the cutoff with WHISPER_FOREGROUND_MAX_SEC.)` }] };
      }
    }

    try {
      let transcribeFrom = filePath;
      let tmpFile: string | null = null;
      if (needsConversion(filePath)) {
        tmpFile = await convertToWav(filePath);
        activeTempFiles.add(tmpFile);
        transcribeFrom = tmpFile;
      }

      const baseNoExt = filePath.replace(/\.[^.]+$/, "");
      const ext = subtitleFormat === "vtt" ? ".vtt" : ".srt";

      let detectedLang = language;
      if (language === "auto") {
        const detected = await detectLanguage(transcribeFrom, WHISPER_MODEL, threads, extraOpts.gpuDevice);
        detectedLang = detected ?? "en";
      }

      const results: string[] = [];

      const nativeDest = language === "en" || detectedLang === "en"
        ? `${baseNoExt}${ext}`
        : `${baseNoExt}.${detectedLang}${ext}`;

      await runSubtitlePass(transcribeFrom, nativeDest, subtitleFormat, WHISPER_MODEL, detectedLang, threads, false, extraOpts);
      results.push(`✅ Native (${detectedLang}): ${nativeDest}`);

      if (translateToEnglish && detectedLang !== "en") {
        const englishDest = `${baseNoExt}.en${ext}`;
        await runSubtitlePass(transcribeFrom, englishDest, subtitleFormat, WHISPER_MODEL, detectedLang, threads, true, extraOpts);
        results.push(`✅ English translation: ${englishDest}`);
      }

      if (tmpFile) { activeTempFiles.delete(tmpFile); if (existsSync(tmpFile)) try { unlinkSync(tmpFile); } catch { } }

      const langNote = language === "auto"
        ? `Auto-detected language: ${detectedLang}\n\n`
        : "";
      const playerNote = subtitleFormat === "vtt"
        ? `Load in web players, HTML5 <video>, or any player that supports WebVTT.`
        : `Load in VLC via Subtitle → Add Subtitle File → select the .srt file.`;

      return {
        content: [{
          type: "text",
          text:
            `✅ Subtitle file(s) generated!\n\n` +
            langNote +
            results.join("\n") + "\n\n" +
            playerNote + "\n\n" +
            `Note: whisper's built-in translation only translates to English. ` +
            `For other target languages, translate the subtitle file contents separately.`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Subtitle generation failed:\n\n${err?.stderr || err?.message || String(err)}` }], isError: true };
    }
  }

  // -------------------------------------------------------------------------
  // transcribe_batch (interactive)
  // -------------------------------------------------------------------------
  if (name === "transcribe_batch") {
    const folderPath = args?.folder_path as string;
    const language = (args?.language as string) || "en";
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));
    const recursive = (args?.recursive as boolean) || false;
    const fileIndex = args?.file_index as number | undefined;
    const outputFormat = ((args?.output_format as string) || "timestamps") as OutputFormat;

    const privacyModeParam = args?.privacy_mode as boolean | undefined;
    const effectivePrivacyMode = privacyModeParam ?? WHISPER_PRIVACY_MODE;

    if (!folderPath) return { content: [{ type: "text", text: "folder_path is required." }], isError: true };
    const folderPathError = validateInputPath(folderPath);
    if (folderPathError) return { content: [{ type: "text", text: folderPathError }], isError: true };
    if (!existsSync(folderPath)) return { content: [{ type: "text", text: `Folder not found: ${folderPath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };

    const files = getFiles(folderPath, recursive);

    if (files.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No supported files found in: ${folderPath}\nSupported formats: ${SUPPORTED_EXTENSIONS.join(", ")}`,
        }],
      };
    }

    if (fileIndex === undefined) {
      return {
        content: [{
          type: "text",
          text:
            `Found ${files.length} file(s) in: ${folderPath}\n\n` +
            files.map((f, i) => {
              const txtPath = f.replace(/\.[^.]+$/, ".txt");
              const done = existsSync(txtPath) ? " ✅ already done" : "";
              return `  ${i + 1}. ${basename(f)}${done}`;
            }).join("\n") +
            `\n\nTo start, say "transcribe file 1" (or any number). I'll process one file at a time and wait for your go-ahead before continuing.\n` +
            `\nFor large unattended batches, use start_batch instead.`,
        }],
      };
    }

    const idx = fileIndex - 1;
    if (idx < 0 || idx >= files.length) {
      return { content: [{ type: "text", text: `Invalid file number. Choose between 1 and ${files.length}.` }], isError: true };
    }

    const filePath = files[idx];
    const fileName = basename(filePath);
    const txtPath = filePath.replace(/\.[^.]+$/, ".txt");

    try {
      // v2.3.0: Privacy gate fires before each file in privacy mode.
      // Each file in transcribe_batch is a separate tool call, so each
      // gets its own confirmation — correct for interactive mode.
      if (effectivePrivacyMode && checkPrivacyGate(opKeyFor(name, args))) {
        return { content: [{ type: "text", text: privacyGateBlock() }] };
      }

      // Non-privacy mode: session consent gate fires once before first file.
      if (!effectivePrivacyMode) {
        const policy = transcriptPolicy();
        if (policy === "consent_gate") {
          return { content: [{ type: "text", text: consentGateBlock() }] };
        }
      }

      const result = await transcribeSingle(filePath, WHISPER_MODEL, language, outputFormat, threads, true, {});
      const remaining = files.length - fileIndex;
      const nextMsg = remaining > 0
        ? `\n\n${remaining} file(s) remaining. Say "continue" or "transcribe file ${fileIndex + 1}" to proceed, or "stop" to finish.`
        : `\n\n✅ That was the last file. Batch complete!`;

      let bodyText: string;
      if (effectivePrivacyMode) {
        const words = estimateWordCount(result.text);
        bodyText =
          `Saved to: ${txtPath}\n` +
          `Words:    ~${words}\n\n` +
          `Privacy mode active — transcript not returned to Claude's API.`;
      } else {
        bodyText =
          `Saved to: ${txtPath}\n\n` +
          `Preview:\n${result.text.slice(0, 500)}${result.text.length > 500 ? "..." : ""}`;
      }

      return {
        content: [{
          type: "text",
          text:
            `[${fileIndex}/${files.length}] ✅ ${fileName}\n\n` +
            bodyText +
            nextMsg,
        }],
      };
    } catch (err: any) {
      return {
        content: [{
          type: "text",
          text:
            `[${fileIndex}/${files.length}] ❌ Failed: ${fileName}\n\n` +
            `Error: ${err?.stderr || err?.message || String(err)}\n\n` +
            `Say "transcribe file ${fileIndex + 1}" to skip and continue.`,
        }],
        isError: true,
      };
    }
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  cleanupOldJobFiles();
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`whisper-windows-mcp v2.5.0 running | threads: ${WHISPER_THREADS}/${SYSTEM_THREADS} | privacy: ${WHISPER_PRIVACY_MODE ? "on" : "off"}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
