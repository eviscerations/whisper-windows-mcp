#!/usr/bin/env node
/**
 * whisper-windows-mcp
 * A Windows-native MCP server for local audio transcription using whisper.cpp
 * https://github.com/your-username/whisper-windows-mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";
import * as path from "path";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration — all values come from environment variables set in
// claude_desktop_config.json so no source code needs to be edited.
// ---------------------------------------------------------------------------
const WHISPER_CLI_PATH =
  process.env.WHISPER_CLI_PATH ?? "C:\\whisper\\Release\\whisper-cli.exe";

const WHISPER_MODEL =
  process.env.WHISPER_MODEL ??
  "C:\\whisper\\models\\ggml-base.en.bin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validatePaths(): string | null {
  if (!existsSync(WHISPER_CLI_PATH)) {
    return `whisper-cli.exe not found at: ${WHISPER_CLI_PATH}\nCheck your WHISPER_CLI_PATH environment variable in claude_desktop_config.json`;
  }
  if (!existsSync(WHISPER_MODEL)) {
    return `Whisper model not found at: ${WHISPER_MODEL}\nCheck your WHISPER_MODEL environment variable in claude_desktop_config.json`;
  }
  return null;
}

type OutputFormat = "text" | "timestamps" | "json";

function buildArgs(
  filePath: string,
  model: string,
  language: string,
  outputFormat: OutputFormat
): string[] {
  const args: string[] = [
    "-m", model,
    "-f", filePath,
    "-l", language,
  ];

  if (outputFormat === "timestamps") {
    // default whisper output includes timestamps
  } else if (outputFormat === "json") {
    args.push("-oj");
  } else {
    // plain text — suppress timestamps
    args.push("--no-timestamps");
  }

  return args;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "whisper-windows-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "transcribe_audio",
      description:
        "Transcribe an audio file using whisper.cpp running locally on Windows. " +
        "Supports mp3, wav, m4a, mp4, and most common audio/video formats. " +
        "Returns the transcribed text.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description:
              "Absolute Windows path to the audio file, e.g. C:\\Users\\You\\Downloads\\recording.mp3",
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
              "text = plain transcript, timestamps = transcript with time codes, json = structured output. Defaults to text.",
            default: "text",
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "check_config",
      description:
        "Verify that whisper-cli.exe and the configured model file can both be found. " +
        "Run this first if transcription fails.",
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
    return {
      content: [
        {
          type: "text",
          text:
            `✅ Configuration looks good!\n\n` +
            `whisper-cli: ${WHISPER_CLI_PATH}\n` +
            `Model:       ${WHISPER_MODEL}`,
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
            text: `File not found: ${filePath}\n\nMake sure the path uses backslashes and is an absolute path, e.g. C:\\Users\\You\\Downloads\\audio.mp3`,
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

    const cliArgs = buildArgs(filePath, model, language, outputFormat);

    try {
      const { stdout, stderr } = await execFileAsync(WHISPER_CLI_PATH, cliArgs, {
        maxBuffer: 100 * 1024 * 1024, // 100 MB — handles long recordings
        windowsHide: true,
      });

      const output = stdout || stderr || "(no output)";
      return { content: [{ type: "text", text: output.trim() }] };
    } catch (err: any) {
      const message =
        err?.stderr || err?.stdout || err?.message || String(err);
      return {
        content: [{ type: "text", text: `Transcription failed:\n\n${message}` }],
        isError: true,
      };
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
  console.error("whisper-windows-mcp running");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
