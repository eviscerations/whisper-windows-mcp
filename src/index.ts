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
import { execFile } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { cpus, tmpdir } from "os";
import { join } from "path";
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

// Video/audio formats that need FFmpeg conversion before whisper-cli can read them
const NEEDS_CONVERSION = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v", ".m4a", ".ogg", ".flac"];
const NATIVE_FORMATS = [".wav", ".mp3"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validatePaths(): string | null {
  if (!existsSync(WHISPER_CLI_PATH)) {
    return (
      `whisper-cli.exe not found at: ${WHISPER_CLI_PATH}\n` +
      `Check your WHISPER_CLI_PATH environment variable in claude_desktop_config.json`
    );
  }
  if (!existsSync(WHISPER_MODEL)) {
    return (
      `Whisper model not found at: ${WHISPER_MODEL}\n` +
      `Check your WHISPER_MODEL environment variable in claude_desktop_config.json`
    );
  }
  return null;
}

function needsConversion(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  return NEEDS_CONVERSION.includes(ext);
}

async function convertToWav(inputPath: string): Promise<string> {
  const tmpFile = join(tmpdir(), `whisper_tmp_${Date.now()}.wav`);
  await execFileAsync(FFMPEG_PATH, [
    "-y",           // overwrite if exists
    "-i", inputPath,
    "-ar", "16000", // 16kHz sample rate (whisper optimal)
    "-ac", "1",     // mono
    "-c:a", "pcm_s16le", // 16-bit PCM WAV
    tmpFile,
  ], { windowsHide: true });
  return tmpFile;
}

type OutputFormat = "text" | "timestamps" | "json";

function buildArgs(
  filePath: string,
  model: string,
  language: string,
  outputFormat: OutputFormat,
  threads: number
): string[] {
  const args: string[] = [
    "-m", model,
    "-f", filePath,
    "-l", language,
    "-t", String(threads),
  ];

  if (outputFormat === "timestamps") {
    // default whisper output includes timestamps
  } else if (outputFormat === "json") {
    args.push("-oj");
  } else {
    args.push("--no-timestamps");
  }

  return args;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "whisper-windows-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "transcribe_audio",
      description:
        "Transcribe an audio or video file using whisper.cpp running locally on Windows. " +
        "Natively supports mp3 and wav. " +
        "Automatically converts video and other audio formats (mp4, mkv, avi, mov, webm, m4a, flac, ogg, etc.) " +
        "via FFmpeg before transcription — no manual conversion needed. " +
        "Note: long files (over 30 minutes) may take significant time and " +
        "cannot be cancelled cleanly from Claude — use Task Manager to stop if needed.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description:
              "Absolute Windows path to the file, e.g. C:\\Users\\You\\Downloads\\recording.mp4",
          },
          model: {
            type: "string",
            description:
              "Override the default model path. Leave blank to use the model configured in WHISPER_MODEL.",
          },
          language: {
            type: "string",
            description: "Language code, e.g. en, es, fr. Defaults to en.",
            default: "en",
          },
          output_format: {
            type: "string",
            enum: ["text", "timestamps", "json"],
            description:
              "text = plain transcript (default), timestamps = transcript with time codes, json = structured output.",
            default: "text",
          },
          threads: {
            type: "number",
            description:
              `Number of CPU threads to use. Defaults to ${WHISPER_THREADS} (half of your ${SYSTEM_THREADS} logical cores). ` +
              `Increase for faster processing, decrease to keep the system responsive.`,
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "check_config",
      description:
        "Verify that whisper-cli.exe and the configured model file can both be found. " +
        "Also reports thread count and FFmpeg availability. Run this first if transcription fails.",
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
    if (error) {
      return {
        content: [{ type: "text", text: `❌ Configuration error:\n\n${error}` }],
        isError: true,
      };
    }

    // Check FFmpeg availability
    let ffmpegStatus = "✅ Found";
    try {
      await execFileAsync(FFMPEG_PATH, ["-version"], { windowsHide: true });
    } catch {
      ffmpegStatus = "⚠️  Not found — video/non-WAV formats will not work without FFmpeg in PATH";
    }

    return {
      content: [
        {
          type: "text",
          text:
            `✅ Configuration looks good!\n\n` +
            `whisper-cli: ${WHISPER_CLI_PATH}\n` +
            `Model:       ${WHISPER_MODEL}\n` +
            `Threads:     ${WHISPER_THREADS} of ${SYSTEM_THREADS} logical cores\n` +
            `FFmpeg:      ${ffmpegStatus}\n\n` +
            `To change thread count, add WHISPER_THREADS to your claude_desktop_config.json env block.\n` +
            `To use a custom FFmpeg path, add FFMPEG_PATH to the env block.`,
        },
      ],
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
    const threads = Math.min(
      SYSTEM_THREADS,
      Math.max(1, Math.round((args?.threads as number) || WHISPER_THREADS))
    );

    if (!filePath) {
      return {
        content: [{ type: "text", text: "file_path is required." }],
        isError: true,
      };
    }

    if (!existsSync(filePath)) {
      return {
        content: [
          {
            type: "text",
            text:
              `File not found: ${filePath}\n\n` +
              `Make sure the path uses backslashes and is absolute, ` +
              `e.g. C:\\Users\\You\\Downloads\\audio.mp3`,
          },
        ],
        isError: true,
      };
    }

    const configError = validatePaths();
    if (configError) {
      return {
        content: [{ type: "text", text: configError }],
        isError: true,
      };
    }

    // Convert to WAV via FFmpeg if needed
    let transcribeFrom = filePath;
    let tmpFile: string | null = null;
    const converting = needsConversion(filePath);

    if (converting) {
      try {
        tmpFile = await convertToWav(filePath);
        transcribeFrom = tmpFile;
      } catch (err: any) {
        const msg = err?.stderr || err?.message || String(err);
        return {
          content: [
            {
              type: "text",
              text:
                `FFmpeg conversion failed:\n\n${msg}\n\n` +
                `Make sure FFmpeg is installed and in your system PATH.\n` +
                `Download from https://ffmpeg.org/download.html\n` +
                `Or convert to MP3 manually using VLC (Media → Convert/Save → Audio - MP3).`,
            },
          ],
          isError: true,
        };
      }
    }

    // Run whisper-cli
    try {
      const cliArgs = buildArgs(transcribeFrom, model, language, outputFormat, threads);
      const { stdout, stderr } = await execFileAsync(WHISPER_CLI_PATH, cliArgs, {
        maxBuffer: 100 * 1024 * 1024,
        windowsHide: true,
      });

      const output = stdout || stderr || "(no output)";
      const note = converting
        ? "\n\n[Automatically converted from video/audio format via FFmpeg before transcription]"
        : "";

      return { content: [{ type: "text", text: output.trim() + note }] };
    } catch (err: any) {
      const message = err?.stderr || err?.stdout || err?.message || String(err);
      return {
        content: [
          { type: "text", text: `Transcription failed:\n\n${message}` },
        ],
        isError: true,
      };
    } finally {
      // Always clean up temp file
      if (tmpFile && existsSync(tmpFile)) {
        try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
      }
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `whisper-windows-mcp v1.1.0 running | threads: ${WHISPER_THREADS}/${SYSTEM_THREADS}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
