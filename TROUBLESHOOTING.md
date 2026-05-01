# Troubleshooting

This document covers the most common issues encountered when setting up `whisper-windows-mcp` on Windows.

---

## "whisper-cli not found" error

**Symptom:** Claude reports `whisper-cli not found` or suggests running `brew install whisper-cpp`.

**What's happening:** The `brew install` suggestion is a macOS instruction and does not apply to Windows. This error means the MCP server cannot locate `whisper-cli.exe`.

**Fix:** Make sure `WHISPER_CLI_PATH` in your `claude_desktop_config.json` points to the exact location of `whisper-cli.exe` on your system, using double backslashes:

```json
"WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe"
```

Verify the file actually exists at that path by opening File Explorer and navigating there.

---

## "File not found" when trying to transcribe

**Symptom:** Claude says the audio file was not found.

**Causes and fixes:**

1. **Wrong path format** — Windows paths must use backslashes. In the chat, type the path with single backslashes as normal:
   ```
   C:\Users\Me\Downloads\recording.mp3
   ```

2. **Spaces in the path** — Paths with spaces are supported but make sure you give Claude the full path.

3. **File doesn't exist** — Double-check the file is where you think it is by navigating to it in File Explorer.

---

## The whisper server shows as "error" or doesn't appear in Settings → Developer

**Symptom:** After adding the config, the whisper server shows a red error badge or doesn't appear at all.

**Fixes to try in order:**

1. Make sure your JSON is valid — a single missing comma or bracket will break the entire config file. Use a JSON validator like [jsonlint.com](https://jsonlint.com) if unsure.

2. Fully quit Claude Desktop (check Task Manager to make sure no Claude processes remain) and reopen it.

3. Make sure Node.js is installed. Open Command Prompt and run:
   ```
   node --version
   ```
   If you get an error, download Node.js from [nodejs.org](https://nodejs.org) and install it.

4. Make sure `npx` works. In Command Prompt:
   ```
   npx --version
   ```

---

## Transcription runs but produces garbled or incorrect text

**Symptom:** The transcript is mostly nonsense, repeating phrases, or in the wrong language.

**Fixes:**

- **Wrong language:** Add `"language": "en"` (or your language code) when asking Claude to transcribe.
- **Poor audio quality:** Whisper works best with clear speech. Background noise, multiple overlapping speakers, or very low bitrate audio will reduce accuracy.
- **Try a larger model:** Larger models (small, medium) are significantly more accurate than tiny or base, at the cost of speed.

---

## Transcription is very slow

**Expected:** On CPU, a 1-hour recording takes roughly 20–60 minutes depending on the model and your processor. This is normal.

**Ways to speed it up:**

- Use a smaller model (`base.en` instead of `medium.en`)
- If you only need the first portion of a recording, trim it first using VLC (**Media → Convert/Save → Edit Profile → set stop time**) or Audacity

> GPU acceleration for AMD (ROCm) and NVIDIA (CUDA) on Windows may be added in a future update.

---

## Claude Desktop fails to install or update (HRESULT 0x80073CF9 / 0x80073CF6)

**Symptom:** The Claude Desktop installer fails with an HRESULT error code.

**This is a Windows MSIX packaging issue, not related to this MCP server.** Steps to resolve:

1. Fully uninstall Claude Desktop via **Settings → Apps → Apps & features**
2. Open Task Manager (**Ctrl+Shift+Esc → Details tab**) and end any remaining Claude or Cowork processes
3. Delete the folder `C:\Users\YourUsername\AppData\Local\AnthropicClaude` if it exists
4. **Restart your computer** — this is important; some package registrations persist in memory until reboot
5. Run the installer again after the reboot

---

## Config file location

If you're not sure where to find `claude_desktop_config.json`:

```
C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json
```

You can also reach it via Claude Desktop → **Settings → Developer → Edit Config**.

The `AppData` folder is hidden by default. To show it in File Explorer: **View → Show → Hidden items**.

---

## Double backslashes in JSON — why?

In JSON, the backslash `\` is an escape character. To represent a single literal backslash (as used in Windows paths), you must write `\\`. So:

| Windows path | In JSON |
|---|---|
| `C:\whisper\Release\whisper-cli.exe` | `"C:\\whisper\\Release\\whisper-cli.exe"` |
| `C:\Users\Me\Downloads\audio.mp3` | `"C:\\Users\\Me\\Downloads\\audio.mp3"` |

This is only required inside the JSON config file. When typing paths directly into Claude in the chat, use normal single backslashes.

---

## Still stuck?

Open an issue at [github.com/your-username/whisper-windows-mcp/issues](https://github.com/your-username/whisper-windows-mcp/issues) and include:

- Your Windows version
- The contents of your `claude_desktop_config.json` (remove any personal info)
- The MCP server log from **Settings → Developer → View Logs**
- What you've already tried
