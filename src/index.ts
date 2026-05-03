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
const WHISPER_MODEL =
  process.env.WHISPER_MODEL ?? "C:\\whisper\\models\\ggml-base.en.bin";
const FFMPEG_PATH =
  process.env.FFMPEG_PATH ?? "ffmpeg";

const SYSTEM_THREADS = cpus().length;
const DEFAULT_THREADS = Math.max(2, Math.floor(SYSTEM_THREADS / 2));
const WHISPER_THREADS = parseInt(process.env.WHISPER_THREADS ?? String(DEFAULT_THREADS), 10);

const SUPPORTED_EXTENSIONS = [
  ".mp3", ".wav",
  ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v",
  ".m4a", ".ogg", ".flac",
];
const NATIVE_EXTENSIONS = [".mp3", ".wav"];

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
  transcribeFrom: string; // may be a converted tmp wav
  isTmp: boolean;         // true if transcribeFrom is a temp file we should clean up
  outputPath: string;
  logPath: string;
  jobPath: string;
  startTime: string;
  model: string;
  language: string;
  threads: number;
  durationSec: number;   // 0 if unknown
  status: "running" | "complete" | "failed";
}

function ensureJobsDir(): void {
  mkdirSync(JOBS_DIR, { recursive: true });
}

async function spawnDetached(
  filePath: string, model: string, language: string, threads: number
): Promise<{ jobId: string; pid: number }> {
  ensureJobsDir();

  const jobId = `job_${Date.now()}`;
  const logPath = join(JOBS_DIR, `${jobId}.log`);
  const jobPath = join(JOBS_DIR, `${jobId}.json`);

  // Convert to WAV first if needed (fast, blocking — keeps things simple)
  let transcribeFrom = filePath;
  let isTmp = false;
  if (needsConversion(filePath)) {
    transcribeFrom = await convertToWav(filePath);
    isTmp = true;
  }

  // Build args — use -otxt so whisper writes outputfile.txt itself
  const outputBase = filePath.replace(/\.[^.]+$/, "");
  const outputPath = outputBase + ".txt";
  const args = [
    "-m", model,
    "-f", transcribeFrom,
    "-l", language,
    "-t", String(threads),
    "-otxt",
    "-of", outputBase,
  ];

  // Spawn detached, redirect both stdout+stderr to log file
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
  const outputExists = existsSync(job.outputPath);

  // Completed
  if (!isRunning && outputExists) {
    job.status = "complete";
    writeFileSync(job.jobPath, JSON.stringify(job, null, 2), "utf8");
    // Clean up tmp wav if present
    if (job.isTmp && existsSync(job.transcribeFrom)) {
      try { unlinkSync(job.transcribeFrom); } catch { }
    }
    const transcript = readFileSync(job.outputPath, "utf8").trim();
    return (
      `✅ Complete!\n\n` +
      `Source: ${basename(job.sourceFile)}\n` +
      `Output: ${job.outputPath}\n\n` +
      `Preview:\n${transcript.slice(0, 600)}${transcript.length > 600 ? "..." : ""}`
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
  if (gb >= 6) return "large-v3 (ggml-large-v3.bin) — fits comfortably in your VRAM";
  if (gb >= 4) return "medium.en (ggml-medium.en.bin) — good fit for your VRAM";
  if (gb >= 2) return "small.en (ggml-small.en.bin) — safe choice for your VRAM";
  return "base.en (ggml-base.en.bin) — recommended for limited VRAM";
}

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

function buildArgs(
  filePath: string, model: string, language: string,
  outputFormat: OutputFormat, threads: number
): string[] {
  const args = ["-m", model, "-f", filePath, "-l", language, "-t", String(threads)];
  if (outputFormat === "srt") {
    args.push("-osrt", "-of", filePath.replace(/\.[^.]+$/, ""));
  } else if (outputFormat === "json") {
    args.push("-oj");
  } else if (outputFormat === "text") {
    args.push("--no-timestamps");
  }
  return args;
}

async function transcribeSingle(
  filePath: string, model: string, language: string,
  outputFormat: OutputFormat, threads: number, saveToFile = false
): Promise<{ text: string; srtPath?: string; savedTo?: string }> {

  // ---- Priority 2: Process lock ----
  // Never spawn a second whisper-cli.exe while one is already running.
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
    const cliArgs = buildArgs(transcribeFrom, model, language, outputFormat, threads);
    const { stdout, stderr } = await execFileAsync(WHISPER_CLI_PATH, cliArgs, {
      maxBuffer: 100 * 1024 * 1024,
      windowsHide: true,
    });

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
  { name: "whisper-windows-mcp", version: "1.7.0" },
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
          model: { type: "string", description: "Override model path. Leave blank to use WHISPER_MODEL." },
          language: { type: "string", description: "Language code, e.g. en, es, fr. Defaults to en.", default: "en" },
          output_format: {
            type: "string", enum: ["text", "timestamps", "json", "srt"],
            description: "text = plain (default), timestamps = with time codes, json = structured, srt = subtitle file saved next to source.",
            default: "text",
          },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
          save_to_file: { type: "boolean", description: "Save transcript as .txt next to the source file.", default: false },
          background: { type: "boolean", description: "Run as a detached background job. Returns a job ID immediately. Use check_progress to monitor. Recommended for files over 10 minutes.", default: false },
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
        "Generate an SRT subtitle file for an audio or video file. " +
        "Saved next to the source file. Load in VLC via Subtitle → Add Subtitle File. " +
        "Supports all the same formats as transcribe_audio.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute Windows path to the file." },
          language: { type: "string", description: "Language code. Defaults to en.", default: "en" },
          threads: { type: "number", description: `CPU threads. Defaults to ${WHISPER_THREADS} of ${SYSTEM_THREADS}.` },
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

    if (!filePath) return { content: [{ type: "text", text: "file_path is required." }], isError: true };
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
        const { jobId, pid } = await spawnDetached(filePath, model, language, threads);
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
      const result = await transcribeSingle(filePath, model, language, outputFormat, threads, saveToFile);
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
  // generate_subtitles
  // -------------------------------------------------------------------------
  if (name === "generate_subtitles") {
    const filePath = args?.file_path as string;
    const language = (args?.language as string) || "en";
    const threads = Math.min(SYSTEM_THREADS, Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS)));

    if (!filePath) return { content: [{ type: "text", text: "file_path is required." }], isError: true };
    if (!existsSync(filePath)) return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
    const configError = validatePaths();
    if (configError) return { content: [{ type: "text", text: configError }], isError: true };

    try {
      const result = await transcribeSingle(filePath, WHISPER_MODEL, language, "srt", threads, false);
      return {
        content: [{
          type: "text",
          text:
            `✅ Subtitle file generated!\n\n` +
            `Saved to: ${result.srtPath}\n\n` +
            `To use in VLC: Subtitle → Add Subtitle File → select the .srt file.\n` +
            `Works in any video player that supports external subtitles.`,
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
      const result = await transcribeSingle(filePath, WHISPER_MODEL, language, "text", threads, true);
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
  console.error(`whisper-windows-mcp v1.7.0 running | threads: ${WHISPER_THREADS}/${SYSTEM_THREADS}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
