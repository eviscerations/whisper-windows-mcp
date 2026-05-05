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
import { join, extname, basename, dirname } from "path";
import { promisify } from "util";

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

const SYSTEM_THREADS = cpus().length;
const DEFAULT_THREADS = Math.max(2, Math.floor(SYSTEM_THREADS / 2));
const WHISPER_THREADS = parseInt(process.env.WHISPER_THREADS ?? String(DEFAULT_THREADS), 10);

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
// Helpers
// ---------------------------------------------------------------------------
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
 * Check whether a whisper-cli.exe process is already running.
 * Uses tasklist /FI which is available on all Windows versions.
 * Returns true if found, false if not (or if tasklist itself fails).
 */
async function isWhisperRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "tasklist",
      ["/FI", "IMAGENAME eq whisper-cli.exe", "/NH"],
      { windowsHide: true }
    );
    return stdout.toLowerCase().includes("whisper-cli.exe");
  } catch {
    // If tasklist fails for any reason, assume safe to proceed
    return false;
  }
}

// ---------------------------------------------------------------------------
// Background job architecture (Priorities 4 + 5)
// ---------------------------------------------------------------------------
const JOBS_DIR = join(tmpdir(), "whisper-mcp-jobs");

interface Job {
  jobId: string;
  pid: number;
  sourceFile: string;
  transcribeFrom: string;
  isTmp: boolean;
  outputPath: string;
  tmpOutputBase: string;
  outputFormat: "text" | "srt";
  logPath: string;
  jobPath: string;
  startTime: string;
  model: string;
  language: string;
  threads: number;
  durationSec: number;
  status: "running" | "complete" | "failed";
}

function ensureJobsDir(): void {
  mkdirSync(JOBS_DIR, { recursive: true });
}

async function spawnDetached(
  filePath: string, model: string, language: string, threads: number,
  outputFormat: "text" | "srt" = "text",
  extraOpts: Partial<WhisperOptions> = {}
): Promise<{ jobId: string; pid: number }> {
  ensureJobsDir();

  const jobId = `job_${Date.now()}`;
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
  // After completion, readJobProgress will move the file to the correct destination.
  const tmpOutputBase = join(JOBS_DIR, jobId);

  // Determine final destination path
  const sourceBase = filePath.replace(/\.[^.]+$/, "");
  const ext = outputFormat === "srt" ? ".srt" : ".txt";
  const outputPath = outputFormat === "srt" && language !== "en" && language !== "auto"
    ? `${sourceBase}.${language}.srt`
    : `${sourceBase}${ext}`;

  // Build args using shared options — ensures quality flags are always applied
  // in background mode, matching blocking mode behaviour.
  const lang = language === "auto" ? "auto" : language;
  const args = [
    "-m", model,
    "-f", transcribeFrom,
    "-l", lang,
    "-t", String(threads),
    // Hallucination prevention — must be in background mode too.
    // --max-context 0 prevents conditioning on prior segment output.
    ...(extraOpts.conditionOnPrevText ? [] : ["--max-context", "0"]),
    // Confirmed valid flag (-nth). Suppresses silent segments from hallucinating.
    "--no-speech-thold", String(extraOpts.noSpeechThold ?? 0.6),
  ];

  if (extraOpts.temperature !== undefined) args.push("--temperature", String(extraOpts.temperature));
  if (extraOpts.prompt) args.push("--prompt", extraOpts.prompt);
  if (extraOpts.beamSize !== undefined) args.push("--beam-size", String(extraOpts.beamSize));
  if (extraOpts.bestOf !== undefined) args.push("--best-of", String(extraOpts.bestOf));
  if (extraOpts.gpuDevice !== undefined) args.push("-g", String(extraOpts.gpuDevice));
  if (extraOpts.processors !== undefined && extraOpts.processors > 1) args.push("-p", String(extraOpts.processors));
  if (extraOpts.offsetT !== undefined) args.push("--offset-t", String(extraOpts.offsetT));
  if (extraOpts.duration !== undefined) args.push("--duration", String(extraOpts.duration));
  if (extraOpts.diarize) args.push("--diarize");
  if (extraOpts.vadModel && existsSync(extraOpts.vadModel)) args.push("--vad", "--vad-model", extraOpts.vadModel);
  if (extraOpts.wordTimestamps) {
    args.push("--max-len", "1", "--split-on-word");
  } else {
    if (extraOpts.maxLen !== undefined) args.push("--max-len", String(extraOpts.maxLen));
    if (extraOpts.splitOnWord) args.push("--split-on-word");
  }

  // Output format
  if (outputFormat === "srt") {
    args.push("-osrt", "-of", tmpOutputBase);
  } else {
    args.push("-otxt", "-of", tmpOutputBase);
  }

  // Spawn detached, redirect stdout+stderr to log file
  const logFd = openSync(logPath, "w");
  const child = spawn(WHISPER_CLI_PATH, args, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });
  closeSync(logFd);
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
  };

  writeFileSync(jobPath, JSON.stringify(job, null, 2), "utf8");
  return { jobId, pid };
}

async function isPidRunning(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "tasklist",
      ["/FI", `PID eq ${pid}`, "/NH"],
      { windowsHide: true }
    );
    return stdout.toLowerCase().includes("whisper-cli.exe");
  } catch {
    return false;
  }
}

function parseLastTimestamp(logContent: string): number {
  // whisper outputs: [00:01:30.000 --> 00:01:35.000]  text
  const re = /\[(\d{2}):(\d{2}):(\d{2})\.\d{3} -->/g;
  let lastSec = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(logContent)) !== null) {
    const sec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    if (sec > lastSec) lastSec = sec;
  }
  return lastSec;
}

async function readJobProgress(jobId: string): Promise<string> {
  const jobPath = join(JOBS_DIR, `${jobId}.json`);
  if (!existsSync(jobPath)) {
    return `❌ Job not found: ${jobId}\n\nThe job file may have been deleted or the ID is incorrect.`;
  }

  const job: Job = JSON.parse(readFileSync(jobPath, "utf8"));

  // Read log
  let logContent = "";
  if (existsSync(job.logPath)) {
    logContent = readFileSync(job.logPath, "utf8");
  }

  const lastSec = parseLastTimestamp(logContent);
  const isRunning = await isPidRunning(job.pid);
  const ext = job.outputFormat === "srt" ? ".srt" : ".txt";
  const tmpOutput = `${job.tmpOutputBase}${ext}`;
  const outputExists = existsSync(job.outputPath) || existsSync(tmpOutput);

  // Completed
  if (!isRunning && outputExists) {
    // Move temp output file to correct destination if needed
    const ext = job.outputFormat === "srt" ? ".srt" : ".txt";
    const tmpOutput = `${job.tmpOutputBase}${ext}`;
    if (existsSync(tmpOutput) && tmpOutput !== job.outputPath) {
      try {
        writeFileSync(job.outputPath, readFileSync(tmpOutput, "utf8"), "utf8");
        unlinkSync(tmpOutput);
      } catch { }
    }
    job.status = "complete";
    writeFileSync(job.jobPath, JSON.stringify(job, null, 2), "utf8");
    // Clean up tmp wav if present
    if (job.isTmp && existsSync(job.transcribeFrom)) {
      try { unlinkSync(job.transcribeFrom); } catch { }
    }
    const outputContent = readFileSync(job.outputPath, "utf8").trim();
    const preview = job.outputFormat === "srt"
      ? outputContent.split("\n").slice(0, 20).join("\n")
      : outputContent.slice(0, 600);
    return (
      `✅ Complete!\n\n` +
      `Source: ${basename(job.sourceFile)}\n` +
      `Output: ${job.outputPath}\n\n` +
      `Preview:\n${preview}${outputContent.length > 600 && job.outputFormat !== "srt" ? "..." : ""}`
    );
  }

  // Failed
  if (!isRunning && !outputExists) {
    job.status = "failed";
    writeFileSync(job.jobPath, JSON.stringify(job, null, 2), "utf8");
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
// Sequential batch with validation (Priority 6)
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
  for (let i = state.currentIndex; i < state.files.length; i++) {
    if (state.files[i].status === "pending") {
      state.currentIndex = i;
      state.files[i].status = "running";
      const f = state.files[i];
      const { jobId } = await spawnDetached(f.filePath, state.model, state.language, state.threads);
      state.files[i].jobId = jobId;
      writeFileSync(state.batchPath, JSON.stringify(state, null, 2), "utf8");
      return;
    }
  }
  // Nothing left to run
  state.status = "complete";
  writeFileSync(state.batchPath, JSON.stringify(state, null, 2), "utf8");
}

async function readBatchProgress(batchId: string): Promise<string> {
  const batchPath = join(JOBS_DIR, `${batchId}.batch.json`);
  if (!existsSync(batchPath)) {
    return `❌ Batch not found: ${batchId}\n\nThe batch file may have been deleted or the ID is incorrect.`;
  }

  const state: BatchState = JSON.parse(readFileSync(batchPath, "utf8"));

  // Check current running job
  const running = state.files.find(f => f.status === "running");
  if (running && running.jobId) {
    const jobPath = join(JOBS_DIR, `${running.jobId}.json`);
    if (existsSync(jobPath)) {
      const job = JSON.parse(readFileSync(jobPath, "utf8"));
      const isRunning = await isPidRunning(job.pid);
      const outputExists = existsSync(job.outputPath);

      if (!isRunning) {
        // Move temp output to final destination if needed.
        // spawnDetached writes to a sanitized JOBS_DIR temp path to avoid Unicode
        // filename issues. readJobProgress normally handles this move, but
        // readBatchProgress must do it too since it never calls readJobProgress.
        const ext = job.outputFormat === "srt" ? ".srt" : ".txt";
        const tmpOutput = `${job.tmpOutputBase}${ext}`;
        if (existsSync(tmpOutput) && tmpOutput !== job.outputPath) {
          try {
            writeFileSync(job.outputPath, readFileSync(tmpOutput, "utf8"), "utf8");
            unlinkSync(tmpOutput);
          } catch { /* ignore — validateTranscript will catch missing output */ }
        }
        // Clean up temp WAV if present
        if (job.isTmp && existsSync(job.transcribeFrom)) {
          try { unlinkSync(job.transcribeFrom); } catch { }
        }

        // Job finished — validate and advance
        const finalOutputExists = existsSync(job.outputPath);
        const validation = validateTranscript(job.outputPath, running.durationSec);
        if (finalOutputExists && validation.valid) {
          running.status = "complete";
        } else {
          running.status = "failed";
          running.failReason = validation.reason ?? "no output file";
        }
        // Advance to next
        state.currentIndex = state.files.indexOf(running) + 1;
        if (state.files.some(f => f.status === "pending")) {
          await spawnNextBatchJob(state);
        } else {
          state.status = "complete";
          writeFileSync(batchPath, JSON.stringify(state, null, 2), "utf8");
        }
      } else {
        // Still running — update state file without advancing
        writeFileSync(batchPath, JSON.stringify(state, null, 2), "utf8");
      }
    }
  } else if (state.status !== "complete" && state.files.some(f => f.status === "pending")) {
    // No running job but pending files exist — advance
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
// GPU / system detection (Priority 9)
// ---------------------------------------------------------------------------
interface GpuInfo {
  name: string;
  vramBytes: number;
}

async function detectGpus(): Promise<GpuInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      "wmic",
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
  // Full-precision English
  { name: "tiny.en",              filename: "ggml-tiny.en.bin",              sizeMb: 75,   multilingual: false, quantized: false, useCase: "Quick tests, lowest accuracy",                       url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin" },
  { name: "base.en",              filename: "ggml-base.en.bin",              sizeMb: 142,  multilingual: false, quantized: false, useCase: "Fast English, good accuracy",                         url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" },
  { name: "small.en",             filename: "ggml-small.en.bin",             sizeMb: 466,  multilingual: false, quantized: false, useCase: "Better English accuracy",                             url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin" },
  { name: "medium.en",            filename: "ggml-medium.en.bin",            sizeMb: 1500, multilingual: false, quantized: false, useCase: "High accuracy English, fast on GPU",                  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin" },
  // Full-precision multilingual
  { name: "tiny",                 filename: "ggml-tiny.bin",                 sizeMb: 75,   multilingual: true,  quantized: false, useCase: "Multilingual, minimal accuracy",                      url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" },
  { name: "base",                 filename: "ggml-base.bin",                 sizeMb: 142,  multilingual: true,  quantized: false, useCase: "Multilingual, fast",                                  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" },
  { name: "small",                filename: "ggml-small.bin",                sizeMb: 466,  multilingual: true,  quantized: false, useCase: "Multilingual, better accuracy",                       url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" },
  { name: "medium",               filename: "ggml-medium.bin",               sizeMb: 1500, multilingual: true,  quantized: false, useCase: "Multilingual, high accuracy",                         url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin" },
  { name: "large-v3",             filename: "ggml-large-v3.bin",             sizeMb: 2900, multilingual: true,  quantized: false, useCase: "Best accuracy, multilingual — requires 6GB+ VRAM",   url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin" },
  { name: "large-v3-turbo",       filename: "ggml-large-v3-turbo.bin",       sizeMb: 1600, multilingual: true,  quantized: false, useCase: "~6x faster than large-v3, minimal accuracy loss — RECOMMENDED for English GPU batch work", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" },
  // Quantized variants — smaller, CPU-friendly
  { name: "base.en-q5_1",         filename: "ggml-base.en-q5_1.bin",         sizeMb: 57,   multilingual: false, quantized: true,  useCase: "Tiny English model, CPU-friendly",                   url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin" },
  { name: "small.en-q5_1",        filename: "ggml-small.en-q5_1.bin",        sizeMb: 181,  multilingual: false, quantized: true,  useCase: "Fast English, low memory, good for CPU",              url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin" },
  { name: "medium.en-q5_0",       filename: "ggml-medium.en-q5_0.bin",       sizeMb: 514,  multilingual: false, quantized: true,  useCase: "High accuracy English, CPU-friendly — good default for no-GPU systems", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin" },
  { name: "large-v3-q5_0",        filename: "ggml-large-v3-q5_0.bin",        sizeMb: 1080, multilingual: true,  quantized: true,  useCase: "Best multilingual quality at half the size",           url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin" },
  { name: "large-v3-turbo-q5_0",  filename: "ggml-large-v3-turbo-q5_0.bin",  sizeMb: 547,  multilingual: true,  quantized: true,  useCase: "RECOMMENDED for CPU-only multilingual — fast, low memory, good accuracy", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin" },
  { name: "large-v3-turbo-q8_0",  filename: "ggml-large-v3-turbo-q8_0.bin",  sizeMb: 874,  multilingual: true,  quantized: true,  useCase: "Turbo quality closer to full precision, moderate size", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin" },
];

// Security: only allow downloads from these Hugging Face namespaces.
const ALLOWED_HF_PREFIXES = [
  "https://huggingface.co/ggerganov/whisper.cpp/",
  "https://huggingface.co/ggml-org/",
];

function hasVulkanDll(): boolean {
  const whisperDir = dirname(WHISPER_CLI_PATH);
  return existsSync(join(whisperDir, "ggml-vulkan.dll"));
}

// ---------------------------------------------------------------------------
// Media analysis (Priority 3)
// ---------------------------------------------------------------------------
interface MediaInfo {
  filePath: string;
  fileName: string;
  durationSec: number;
  sizeMb: number;
  codec: string;
  bitrate: number; // kbps
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

    return {
      filePath,
      fileName: basename(filePath),
      durationSec,
      sizeMb,
      codec,
      bitrate,
    };
  } catch {
    return null;
  }
}

function formatDuration(sec: number): string {
  if (!sec) return "?:??";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function estimateTime(durationSec: number, gpu: boolean): string {
  if (!durationSec) return "?";
  // CPU: ~1.5x realtime on Ryzen 7 2700x with medium.en
  // GPU: ~0.12x realtime on Vega 56 via Vulkan with medium.en (~8x faster than CPU)
  const ratio = gpu ? 0.12 : 1.5;
  const estSec = Math.round(durationSec * ratio);
  if (estSec < 60) return `~${estSec}s`;
  return `~${Math.round(estSec / 60)}m`;
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
  const tmpFile = join(tmpdir(), `whisper_tmp_${Date.now()}.wav`);
  await execFileAsync(FFMPEG_PATH, [
    "-y", "-i", inputPath,
    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tmpFile,
  ], { windowsHide: true });
  return tmpFile;
}

type OutputFormat = "text" | "timestamps" | "json" | "srt";

// ---------------------------------------------------------------------------
// Whisper CLI options
// ---------------------------------------------------------------------------
interface WhisperOptions {
  language: string;
  outputFormat: OutputFormat;
  threads: number;
  translate?: boolean;
  temperature?: number;          // 0.0–1.0, default 0.0 (deterministic)
  prompt?: string;               // prior context string injected before transcription
  conditionOnPrevText?: boolean; // default false — hardcoded off for hallucination prevention
  noSpeechThold?: number;        // default 0.6
  beamSize?: number;             // beam search width, default 5
  bestOf?: number;               // candidate sequences evaluated, default 5
  gpuDevice?: number;            // GPU index for multi-GPU systems
  processors?: number;           // parallel processor count
  maxLen?: number;               // max segment length in characters
  splitOnWord?: boolean;         // split at word boundaries
  wordTimestamps?: boolean;      // shorthand: sets maxLen=1 + splitOnWord=true
  diarize?: boolean;             // stereo speaker diarization (requires stereo audio)
  vadModel?: string;             // path to Silero VAD model .bin for voice activity detection
  offsetT?: number;              // start offset in milliseconds
  duration?: number;             // process duration in milliseconds
}

function buildArgs(filePath: string, model: string, opts: WhisperOptions): string[] {
  const lang = opts.language === "auto" ? "auto" : opts.language;
  const args = ["-m", model, "-f", filePath, "-l", lang, "-t", String(opts.threads)];

  // Hallucination prevention — set max context tokens to 0 to prevent whisper
  // from conditioning each segment on its own prior output, which causes
  // repetitive hallucination loops on noisy or silent audio.
  // Flag: --max-context 0 (user can re-enable by setting conditionOnPrevText=true)
  if (!opts.conditionOnPrevText) args.push("--max-context", "0");

  // Treat segments below this confidence threshold as silence rather than
  // hallucinating content. Confirmed valid flag in whisper-cli (-nth).
  args.push("--no-speech-thold", String(opts.noSpeechThold ?? 0.6));

  if (opts.translate) args.push("--translate");

  if (opts.temperature !== undefined) args.push("--temperature", String(opts.temperature));
  if (opts.prompt) args.push("--prompt", opts.prompt);
  if (opts.beamSize !== undefined) args.push("--beam-size", String(opts.beamSize));
  if (opts.bestOf !== undefined) args.push("--best-of", String(opts.bestOf));
  if (opts.gpuDevice !== undefined) args.push("-g", String(opts.gpuDevice));
  if (opts.processors !== undefined && opts.processors > 1) args.push("-p", String(opts.processors));
  if (opts.offsetT !== undefined) args.push("--offset-t", String(opts.offsetT));
  if (opts.duration !== undefined) args.push("--duration", String(opts.duration));
  if (opts.diarize) args.push("--diarize");

  // word_timestamps: sets max-len=1 + split-on-word for per-word output
  // without requiring JSON parsing — simpler than -oj approach.
  if (opts.wordTimestamps) {
    args.push("--max-len", "1", "--split-on-word");
  } else {
    if (opts.maxLen !== undefined) args.push("--max-len", String(opts.maxLen));
    if (opts.splitOnWord) args.push("--split-on-word");
  }

  // VAD: voice activity detection — strips silence before whisper sees the audio
  if (opts.vadModel && existsSync(opts.vadModel)) {
    args.push("--vad", "--vad-model", opts.vadModel);
  }

  // Output format
  if (opts.outputFormat === "srt") {
    args.push("-osrt", "-of", filePath.replace(/\.[^.]+$/, ""));
  } else if (opts.outputFormat === "json") {
    args.push("-oj");
  } else if (opts.outputFormat === "text") {
    args.push("--no-timestamps");
  }
  // "timestamps" format: no flag — whisper default stdout includes timestamps

  return args;
}

/**
 * Detect the language of a file by running a short whisper probe.
 * Runs whisper on the first 30 seconds only (--duration 30000ms).
 * Returns the detected language code (e.g. "ja", "en") or null on failure.
 */
async function detectLanguage(wavPath: string, model: string, threads: number): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(WHISPER_CLI_PATH, [
      "-m", model, "-f", wavPath,
      "-l", "auto",
      "-t", String(threads),
      "--no-timestamps",
      "--duration", "30000",
    ], { maxBuffer: 10 * 1024 * 1024, windowsHide: true });
    const output = stdout + stderr;
    // whisper outputs: "auto-detected language: ja (p = 0.98)"
    const m = output.match(/auto-detected language:\s*([a-z]{2,3})/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Run a single whisper SRT pass and move the output to destSrt.
 * Returns the destSrt path.
 */
async function runSrtPass(
  transcribeFrom: string, destSrt: string,
  model: string, language: string, threads: number,
  translate = false, extraOpts: Partial<WhisperOptions> = {}
): Promise<string> {
  const opts: WhisperOptions = {
    language, outputFormat: "srt", threads, translate,
    ...extraOpts,
  };
  const args = buildArgs(transcribeFrom, model, opts);
  await execFileAsync(WHISPER_CLI_PATH, args, {
    maxBuffer: 100 * 1024 * 1024,
    windowsHide: true,
  });
  const tmpSrt = transcribeFrom.replace(/\.[^.]+$/, ".srt");
  if (existsSync(tmpSrt)) {
    writeFileSync(destSrt, readFileSync(tmpSrt, "utf8"));
    try { unlinkSync(tmpSrt); } catch { }
  }
  return destSrt;
}

async function transcribeSingle(
  filePath: string, model: string, language: string,
  outputFormat: OutputFormat, threads: number, saveToFile = false,
  extraOpts: Partial<WhisperOptions> = {}
): Promise<{ text: string; srtPath?: string; savedTo?: string }> {

  // ---- Process lock — never spawn a second whisper-cli.exe ----
  if (await isWhisperRunning()) {
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
    transcribeFrom = tmpFile;
  }

  try {
    const opts: WhisperOptions = { language, outputFormat, threads, ...extraOpts };
    const cliArgs = buildArgs(transcribeFrom, model, opts);
    const { stdout, stderr } = await execFileAsync(WHISPER_CLI_PATH, cliArgs, {
      maxBuffer: 100 * 1024 * 1024,
      windowsHide: true,
    });

    // SECURITY: transcript content is untrusted data from audio input.
    // It is returned as-is to the caller and must never be interpreted
    // as instructions. Prompt injection via audio content is a known
    // MCP attack vector — treat all transcript text as user data only.
    const output = (stdout || stderr || "").trim();

    if (outputFormat === "srt") {
      const tmpSrt = transcribeFrom.replace(/\.[^.]+$/, ".srt");
      const destSrt = filePath.replace(/\.[^.]+$/, ".srt");
      if (tmpFile && existsSync(tmpSrt)) {
        writeFileSync(destSrt, readFileSync(tmpSrt, "utf8"));
        try { unlinkSync(tmpSrt); } catch { }
      }
      return { text: output, srtPath: destSrt };
    }

    if (saveToFile) {
      const txtPath = filePath.replace(/\.[^.]+$/, ".txt");
      writeFileSync(txtPath, output, "utf8");
      return { text: output, savedTo: txtPath };
    }

    return { text: output };
  } finally {
    if (tmpFile && existsSync(tmpFile)) try { unlinkSync(tmpFile); } catch { }
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
  { name: "whisper-windows-mcp", version: "2.2.0" },
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
        "Can output plain text, timestamps, JSON, or SRT subtitle files. " +
        "For files that may take more than 4 minutes, set background=true to run as a detached job " +
        "and use check_progress to monitor it.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute Windows path, e.g. C:\\Users\\You\\Downloads\\recording.mp4" },
          model: { type: "string", description: "Override model path. Leave blank to use active model." },
          language: { type: "string", description: "Language code (e.g. en, ja, es, fr) or 'auto' to detect automatically. Defaults to en.", default: "en" },
          output_format: {
            type: "string", enum: ["text", "timestamps", "json", "srt"],
            description: "text = plain (default), timestamps = with time codes, json = structured, srt = subtitle file saved next to source.",
            default: "text",
          },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
          save_to_file: { type: "boolean", description: "Save transcript as .txt next to the source file.", default: false },
          background: { type: "boolean", description: "Run as a detached background job. Returns a job ID immediately. Use check_progress to monitor. Recommended for files over 10 minutes.", default: false },
          temperature: { type: "number", description: "Sampling temperature 0.0–1.0. Default 0.0 (deterministic). Higher values reduce hallucination on noisy audio at the cost of consistency." },
          prompt: { type: "string", description: "Prior context string injected before transcription. Improves accuracy for domain-specific vocabulary, speaker names, or technical terms. Example: 'Names: Keemstar, DramaAlert.'" },
          condition_on_prev_text: { type: "boolean", description: "Re-enable conditioning each segment on its own prior output (removes --max-context 0 flag). Default false (off). Only enable for highly structured audio where context continuity helps.", default: false },
          no_speech_thold: { type: "number", description: "Confidence threshold below which segments are treated as silence rather than transcribed. Default 0.6.", default: 0.6 },
          beam_size: { type: "number", description: "Beam search width. Higher = more accurate but slower. Default 5." },
          best_of: { type: "number", description: "Number of candidate sequences to evaluate. Default 5." },
          gpu_device: { type: "number", description: "GPU device index for multi-GPU systems. Use check_system to see available GPUs. Default 0." },
          processors: { type: "number", description: "Number of parallel processors for chunk processing. Default 1." },
          word_timestamps: { type: "boolean", description: "Output one word per timestamped segment (sets --max-len 1 --split-on-word). Useful for clip alignment and precise timecode search.", default: false },
          max_segment_length: { type: "number", description: "Maximum segment length in characters. Controls line break frequency in output. Ignored when word_timestamps=true." },
          split_on_word: { type: "boolean", description: "Split segments at word boundaries rather than mid-word. Defaults to false.", default: false },
          diarize: { type: "boolean", description: "Stereo speaker diarization — labels left/right channel speakers in transcript. Requires stereo audio with speakers on separate channels.", default: false },
          vad_model: { type: "string", description: "Absolute path to a Silero VAD model .bin file. When provided, voice activity detection strips silence before transcription — reduces hallucinations and speeds up processing. Download via download_model." },
          offset_t: { type: "number", description: "Start transcription at this offset in milliseconds. Use to process a specific section of a file." },
          duration: { type: "number", description: "Process only this many milliseconds of audio starting from offset_t (or the beginning). Use with offset_t to target a specific time window." },
        },
        required: ["file_path"],
      },
    },
    {
      name: "check_progress",
      description:
        "Check the status of a background transcription job started with transcribe_audio (background=true). " +
        "Returns current progress, elapsed time, last processed timestamp, and the transcript when complete. " +
        "Call this repeatedly until the job shows as complete or failed.",
      inputSchema: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "Job ID returned by transcribe_audio when background=true." },
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
        "NOTE: For large unattended batch jobs, use whisper-cli.exe directly from the command line " +
        "— see TROUBLESHOOTING.md for the command syntax.",
      inputSchema: {
        type: "object",
        properties: {
          folder_path: { type: "string", description: "Absolute Windows path to the folder." },
          file_index: {
            type: "number",
            description: "Which file to process (1-based). Omit to list files first.",
          },
          language: { type: "string", description: "Language code. Defaults to en.", default: "en" },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
          recursive: { type: "boolean", description: "Include subfolders. Defaults to false.", default: false },
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
        "When both are requested, two .srt files are saved: one in the original language (e.g. film.ja.srt) " +
        "and one English translation (film.en.srt). " +
        "Load in VLC via Subtitle → Add Subtitle File. " +
        "Supports all standard formats plus .3gp and .ts.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute Windows path to the file." },
          language: {
            type: "string",
            description: "Language code (e.g. ja, es, fr, de) or 'auto' to detect automatically. Defaults to en.",
            default: "en",
          },
          translate_to_english: {
            type: "boolean",
            description: "Also generate an English translation .srt alongside the native language .srt. Only applies when language is not 'en'. Not available in background mode.",
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
          diarize: { type: "boolean", description: "Stereo speaker diarization. Requires stereo audio with speakers on separate channels.", default: false },
          vad_model: { type: "string", description: "Path to Silero VAD model .bin. Strips silence before transcription. Download via download_model." },
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
        "Returns a batch ID to use with check_batch_progress.",
      inputSchema: {
        type: "object",
        properties: {
          folder_path: { type: "string", description: "Absolute Windows path to the folder." },
          language: { type: "string", description: "Language code. Defaults to en.", default: "en" },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
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
          path: {
            type: "string",
            description: "Absolute Windows path to a single file or a folder.",
          },
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
        "and recommends the best Whisper model for your hardware. " +
        "Run this if you want to confirm GPU acceleration is working or diagnose why it isn't.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_models",
      description:
        "List all Whisper model files installed in your models directory. " +
        "Shows filename, size, whether it is currently active, quantization status, " +
        "and recommended use case for each model. " +
        "No network calls — reads local filesystem only.",
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
          model_name: {
            type: "string",
            description: "Model name to download, e.g. 'large-v3-turbo', 'medium.en-q5_0', 'large-v3-turbo-q5_0'. Use list_models to see what is already installed.",
          },
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
        "Use list_models to see installed models, download_model to add new ones. " +
        "Change is session-scoped — does not persist after Claude Desktop restarts.",
      inputSchema: {
        type: "object",
        properties: {
          model_name: {
            type: "string",
            description: "Model filename (e.g. ggml-large-v3-turbo.bin) or full path. Must be a .bin file in the configured models directory.",
          },
        },
        required: ["model_name"],
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

    return {
      content: [{
        type: "text",
        text:
          `✅ Configuration looks good!\n\n` +
          `whisper-cli: ${WHISPER_CLI_PATH}\n` +
          `Model:       ${WHISPER_MODEL}\n` +
          `Threads:     ${WHISPER_THREADS} of ${SYSTEM_THREADS} logical cores\n` +
          `FFmpeg:      ${ffmpegStatus}\n\n` +
          `Optional env vars: WHISPER_THREADS, FFMPEG_PATH`,
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
    if (!existsSync(targetPath)) return { content: [{ type: "text", text: `Path not found: ${targetPath}` }], isError: true };

    // Check ffprobe is available
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

    // Single file
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

    // Folder scan
    const files = getFiles(targetPath, false);
    if (files.length === 0) {
      return { content: [{ type: "text", text: `No supported media files found in: ${targetPath}` }], isError: true };
    }

    const results: MediaInfo[] = [];
    for (const f of files) {
      const info = await probeFile(f);
      if (info) results.push(info);
    }

    // Sort
    if (sortBy === "name") results.sort((a, b) => a.fileName.localeCompare(b.fileName));
    else if (sortBy === "size") results.sort((a, b) => a.sizeMb - b.sizeMb);
    else results.sort((a, b) => a.durationSec - b.durationSec); // duration default

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
      gpuLines = "⚠️  No GPU detected via wmic — this may indicate a driver issue.\n";
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

    // Also list downloadable models not yet installed
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

    // Security: enforce URL whitelist — never download from arbitrary URLs
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

    // Download using Node.js built-in https — no external dependencies
    try {
      const https = await import("https");
      const fs = await import("fs");

      await new Promise<void>((resolve, reject) => {
        const tmpPath = destPath + ".part";
        const file = fs.createWriteStream(tmpPath);

        function doRequest(url: string) {
          https.get(url, (res) => {
            // Follow redirects (Hugging Face uses redirects)
            if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
              const redirectUrl = res.headers.location;
              // Security: ensure redirect stays within allowed domains
              const redirectOk = ALLOWED_HF_PREFIXES.some(p => redirectUrl.startsWith(p))
                || redirectUrl.startsWith("https://cdn-lfs.huggingface.co/")
                || redirectUrl.startsWith("https://cdn-lfs-us-1.huggingface.co/");
              if (!redirectOk) { reject(new Error(`Redirect to disallowed URL: ${redirectUrl}`)); return; }
              doRequest(redirectUrl);
              return;
            }
            if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} from ${url}`)); return; }
            res.pipe(file);
            // Wait for close callback before renaming — Windows requires the file
            // handle to be fully released before renameSync will succeed.
            file.on("finish", () => {
              file.close((closeErr) => {
                if (closeErr) { reject(closeErr); return; }
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

    // Security: must end in .bin
    if (!modelInput.endsWith(".bin")) {
      return {
        content: [{ type: "text", text: `Invalid model: "${modelInput}"\nModel files must end in .bin` }],
        isError: true,
      };
    }

    // Security: reject path traversal
    if (UNSAFE_PATH_RE.test(modelInput)) {
      return {
        content: [{ type: "text", text: `Invalid path: "${modelInput}"\nPaths containing ".." or UNC paths are not allowed.` }],
        isError: true,
      };
    }

    // Resolve to full path — either absolute or relative to models dir
    const modelsDir = dirname(WHISPER_MODEL);
    const resolvedPath = modelInput.includes("\\") || modelInput.includes("/")
      ? modelInput
      : join(modelsDir, modelInput);

    // Security: must live within the configured models directory
    if (!resolvedPath.startsWith(modelsDir)) {
      return {
        content: [{ type: "text", text: `Security error: model must be within the configured models directory (${modelsDir}).` }],
        isError: true,
      };
    }

    if (!existsSync(resolvedPath)) {
      return {
        content: [{
          type: "text",
          text:
            `Model not found: ${resolvedPath}\n\n` +
            `Use list_models to see installed models, or download_model to install a new one.`,
        }],
        isError: true,
      };
    }

    // Process lock — don't switch mid-transcription
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

    return {
      content: [{
        type: "text",
        text:
          `✅ Model switched!\n\n` +
          `Previous: ${previousModel}\n` +
          `Active:   ${newModel} (${sizeMb} MB)\n` +
          (known ? `Use case: ${known.useCase}\n` : "") +
          `\nThis change is session-scoped. To make it permanent, update WHISPER_MODEL in claude_desktop_config.json.`,
      }],
    };
  }

  // -------------------------------------------------------------------------
  // transcribe_audio
  // -------------------------------------------------------------------------
  if (name === "transcribe_audio") {
    const filePath = args?.file_path as string;
    const model = (args?.model as string) || WHISPER_MODEL;
    const language = (args?.language as string) || "en";
    const outputFormat = ((args?.output_format as string) || "text") as OutputFormat;
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));
    const saveToFile = (args?.save_to_file as boolean) || false;
    const background = (args?.background as boolean) || false;

    // v2.2.0 quality and control params
    const extraOpts: Partial<WhisperOptions> = {};
    if (args?.temperature !== undefined) extraOpts.temperature = Number(args.temperature);
    if (args?.prompt) extraOpts.prompt = String(args.prompt);
    if (args?.condition_on_prev_text !== undefined) extraOpts.conditionOnPrevText = Boolean(args.condition_on_prev_text);
    if (args?.no_speech_thold !== undefined) extraOpts.noSpeechThold = Number(args.no_speech_thold);
    if (args?.beam_size !== undefined) extraOpts.beamSize = Number(args.beam_size);
    if (args?.best_of !== undefined) extraOpts.bestOf = Number(args.best_of);
    if (args?.gpu_device !== undefined) extraOpts.gpuDevice = Number(args.gpu_device);
    if (args?.processors !== undefined) extraOpts.processors = Number(args.processors);
    if (args?.word_timestamps) extraOpts.wordTimestamps = true;
    if (args?.max_segment_length !== undefined) extraOpts.maxLen = Number(args.max_segment_length);
    if (args?.split_on_word) extraOpts.splitOnWord = true;
    if (args?.diarize) extraOpts.diarize = true;
    if (args?.vad_model) extraOpts.vadModel = String(args.vad_model);
    if (args?.offset_t !== undefined) extraOpts.offsetT = Number(args.offset_t);
    if (args?.duration !== undefined) extraOpts.duration = Number(args.duration);

    if (!filePath) return { content: [{ type: "text", text: "file_path is required." }], isError: true };
    const pathError = validateInputPath(filePath);
    if (pathError) return { content: [{ type: "text", text: pathError }], isError: true };
    if (!existsSync(filePath)) return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };

    // Background mode — detached process, returns immediately
    if (background) {
      if (await isWhisperRunning()) {
        return {
          content: [{ type: "text", text: "Transcription already in progress. Wait for the current job to finish before starting another." }],
          isError: true,
        };
      }
      try {
        const { jobId, pid } = await spawnDetached(filePath, model, language, threads, outputFormat === "srt" ? "srt" : "text", extraOpts);
        return {
          content: [{
            type: "text",
            text:
              `⏳ Background transcription started.\n\n` +
              `Source: ${basename(filePath)}\n` +
              `Job ID: ${jobId}\n` +
              `PID: ${pid}\n\n` +
              `Call check_progress with job_id="${jobId}" to monitor progress.\n` +
              `Output will be saved to: ${filePath.replace(/\.[^.]+$/, ".txt")}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed to start background job:\n\n${err?.message || String(err)}` }], isError: true };
      }
    }

    // Blocking mode (default)
    try {
      const result = await transcribeSingle(filePath, model, language, outputFormat, threads, saveToFile, extraOpts);
      let response = result.text;
      if (result.savedTo) response += `\n\n[Transcript saved to: ${result.savedTo}]`;
      if (result.srtPath) response += `\n\n[SRT subtitle file saved to: ${result.srtPath}]`;
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
    if (!jobId) return { content: [{ type: "text", text: "job_id is required." }], isError: true };
    try {
      const result = await readJobProgress(jobId);
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

    if (!folderPath) return { content: [{ type: "text", text: "folder_path is required." }], isError: true };
    const pathError = validateInputPath(folderPath);
    if (pathError) return { content: [{ type: "text", text: pathError }], isError: true };
    if (!existsSync(folderPath)) return { content: [{ type: "text", text: `Folder not found: ${folderPath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };

    if (await isWhisperRunning()) {
      return { content: [{ type: "text", text: "A transcription is already running. Wait for it to finish before starting a batch." }], isError: true };
    }

    // Scan for untranscribed files
    const allFiles = getFiles(folderPath, false);
    const untranscribed = allFiles.filter(f => !existsSync(f.replace(/\.[^.]+$/, ".txt")));

    if (untranscribed.length === 0) {
      return { content: [{ type: "text", text: `✅ All files in ${folderPath} are already transcribed. Nothing to do.` }] };
    }

    // Probe durations for sorting
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
    const batchId = `batch_${Date.now()}`;
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
    };

    writeFileSync(batchPath, JSON.stringify(state, null, 2), "utf8");
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
          `Est. GPU time: ${estimateTime(totalDuration, hasVulkanDll())}\n\n` +
          `First file: ${batchFiles[0].fileName}\n\n` +
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
    const translateToEnglish = (args?.translate_to_english as boolean) || false;
    const background = (args?.background as boolean) || false;
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));

    // v2.2.0 quality params
    const extraOpts: Partial<WhisperOptions> = {};
    if (args?.temperature !== undefined) extraOpts.temperature = Number(args.temperature);
    if (args?.prompt) extraOpts.prompt = String(args.prompt);
    if (args?.beam_size !== undefined) extraOpts.beamSize = Number(args.beam_size);
    if (args?.best_of !== undefined) extraOpts.bestOf = Number(args.best_of);
    if (args?.diarize) extraOpts.diarize = true;
    if (args?.vad_model) extraOpts.vadModel = String(args.vad_model);

    if (!filePath) return { content: [{ type: "text", text: "file_path is required." }], isError: true };
    const pathError = validateInputPath(filePath);
    if (pathError) return { content: [{ type: "text", text: pathError }], isError: true };
    if (!existsSync(filePath)) return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };
    if (await isWhisperRunning()) {
      return { content: [{ type: "text", text: "Transcription already in progress. Wait for it to finish first." }], isError: true };
    }

    // Background mode — detached SRT job
    if (background) {
      try {
        const { jobId, pid } = await spawnDetached(filePath, WHISPER_MODEL, language, threads, "srt", extraOpts);
        return {
          content: [{
            type: "text",
            text:
              `⏳ Background subtitle generation started.\n\n` +
              `Source: ${basename(filePath)}\n` +
              `Job ID: ${jobId}\n` +
              `PID: ${pid}\n` +
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

    try {
      // Convert to WAV if needed
      let transcribeFrom = filePath;
      let tmpFile: string | null = null;
      if (needsConversion(filePath)) {
        tmpFile = await convertToWav(filePath);
        transcribeFrom = tmpFile;
      }

      const baseNoExt = filePath.replace(/\.[^.]+$/, "");

      // Auto-detect language if requested
      let detectedLang = language;
      if (language === "auto") {
        const detected = await detectLanguage(transcribeFrom, WHISPER_MODEL, threads);
        detectedLang = detected ?? "en";
      }

      const results: string[] = [];

      // Pass 1 — native language SRT
      const nativeSrt = language === "en" || detectedLang === "en"
        ? `${baseNoExt}.srt`
        : `${baseNoExt}.${detectedLang}.srt`;

      await runSrtPass(transcribeFrom, nativeSrt, WHISPER_MODEL, detectedLang, threads, false, extraOpts);
      results.push(`✅ Native (${detectedLang}): ${nativeSrt}`);

      // Pass 2 — English translation SRT (only if language isn't already English)
      if (translateToEnglish && detectedLang !== "en") {
        const englishSrt = `${baseNoExt}.en.srt`;
        await runSrtPass(transcribeFrom, englishSrt, WHISPER_MODEL, detectedLang, threads, true, extraOpts);
        results.push(`✅ English translation: ${englishSrt}`);
      }

      // Clean up temp WAV
      if (tmpFile && existsSync(tmpFile)) try { unlinkSync(tmpFile); } catch { }

      const langNote = language === "auto"
        ? `Auto-detected language: ${detectedLang}\n\n`
        : "";

      return {
        content: [{
          type: "text",
          text:
            `✅ Subtitle file(s) generated!\n\n` +
            langNote +
            results.join("\n") + "\n\n" +
            `To use in VLC: Subtitle → Add Subtitle File → select the .srt file.\n` +
            `Works in any video player that supports external subtitles.\n\n` +
            `Note: whisper's built-in translation only translates to English. ` +
            `For other target languages, translate the .srt file contents separately.`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Subtitle generation failed:\n\n${err?.stderr || err?.message || String(err)}` }], isError: true };
    }
  }

  // -------------------------------------------------------------------------
  // transcribe_batch (interactive only)
  // -------------------------------------------------------------------------
  if (name === "transcribe_batch") {
    const folderPath = args?.folder_path as string;
    const language = (args?.language as string) || "en";
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));
    const recursive = (args?.recursive as boolean) || false;
    const fileIndex = args?.file_index as number | undefined;

    if (!folderPath) return { content: [{ type: "text", text: "folder_path is required." }], isError: true };
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

    // No file_index: return file list
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
            `\nFor large unattended batches, see the command line approach in TROUBLESHOOTING.md.`,
        }],
      };
    }

    // Process the requested file
    const idx = fileIndex - 1;
    if (idx < 0 || idx >= files.length) {
      return { content: [{ type: "text", text: `Invalid file number. Choose between 1 and ${files.length}.` }], isError: true };
    }

    const filePath = files[idx];
    const fileName = basename(filePath);
    const txtPath = filePath.replace(/\.[^.]+$/, ".txt");

    try {
      const result = await transcribeSingle(filePath, WHISPER_MODEL, language, "text", threads, true, {});
      const remaining = files.length - fileIndex;
      const nextMsg = remaining > 0
        ? `\n\n${remaining} file(s) remaining. Say "continue" or "transcribe file ${fileIndex + 1}" to proceed, or "stop" to finish.`
        : `\n\n✅ That was the last file. Batch complete!`;

      return {
        content: [{
          type: "text",
          text:
            `[${fileIndex}/${files.length}] ✅ ${fileName}\n\n` +
            `Saved to: ${txtPath}\n\n` +
            `Preview:\n${result.text.slice(0, 500)}${result.text.length > 500 ? "..." : ""}` +
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`whisper-windows-mcp v2.2.0 running | threads: ${WHISPER_THREADS}/${SYSTEM_THREADS}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
