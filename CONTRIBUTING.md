# Contributing to whisper-windows-mcp

Thanks for your interest in contributing. This is a Windows-native MCP server for local audio transcription — contributions that improve Windows compatibility, GPU support, and usability for non-technical users are especially welcome.

---

## Before you start

Check the [open issues](https://github.com/eviscerations/whisper-windows-mcp/issues) before starting work to avoid duplicating effort. If you want to work on something not listed, open an issue first to discuss it.

See [ROADMAP.md](ROADMAP.md) for planned features and known bugs.

---

## What we need most

- **GPU acceleration testing** — if you've tested on NVIDIA, Intel Arc, or AMD hardware not listed in the README, please share your results (GPU model, VRAM, model size, observed throughput)
- **Bug reports with reproduction steps** — especially for Windows-specific issues
- **Multilingual testing** — results with non-English audio and the large-v3 model
- **Documentation improvements** — especially for non-English speakers

---

## Development setup

```
git clone https://github.com/eviscerations/whisper-windows-mcp
cd whisper-windows-mcp
npm install
npm run build
```

The server is a single TypeScript file at `src/index.ts`. The compiled output goes to `dist/`.

To test locally, update your `claude_desktop_config.json` to point at the local build:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "node",
      "args": ["C:\\path\\to\\whisper-windows-mcp\\dist\\index.js"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin"
      }
    }
  }
}
```

Restart Claude Desktop after each build to pick up changes.

---

## Pull request guidelines

- Keep PRs focused — one fix or feature per PR
- Test on Windows (this is a Windows-only tool)
- If adding a new tool, update the tool list in README.md
- If fixing a bug, add a note to TROUBLESHOOTING.md if it's something other users will hit
- Bump the version in `package.json` and the version string in `src/index.ts` before submitting

---

## Code style

- TypeScript, no external runtime dependencies beyond `@modelcontextprotocol/sdk`
- All file I/O must handle non-ASCII filenames (Unicode, Japanese, Chinese, emoji)
- New tools go in the `CallToolRequestSchema` handler following the existing pattern
- Error messages should be actionable — tell the user what to do, not just what went wrong

---

## Reporting bugs

Open an issue with:
- Your OS version (`winver`)
- Node.js version (`node --version`)
- whisper-windows-mcp version
- GPU model and whether you're using the Vulkan build
- Exact steps to reproduce
- Full error output if available

---

## License

By contributing, you agree that your contributions will be licensed under the MIT license.
