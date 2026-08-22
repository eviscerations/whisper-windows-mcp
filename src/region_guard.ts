/**
 * region_guard.ts
 *
 * Sanctions / geo enforcement. whisper-windows-mcp is not licensed for use in the
 * Russian Federation. On a machine detected as Russian the server refuses to run and
 * removes its own installation.
 *
 * Design (deterrent-grade, honest limits):
 *   - TWO independent detection layers so no single tamper blinds it:
 *       Layer A — Node built-ins (Intl time zone/locale + env). Always available; cannot
 *                 be disabled by shimming or blocking PowerShell. Acts as an ever-present
 *                 Russian detector and a sabotage backstop. It NEVER grants a clean pass.
 *       Layer B — authoritative Windows settings via PowerShell at an absolute path.
 *                 Required for a CLEAN verdict.
 *   - FAIL-CLOSED: a clean pass requires Layer B to succeed. If the authoritative probe
 *     cannot run, the verdict is "unverified" -> refuse to run. Killing the probe is not
 *     a bypass, it is a block.
 *   - Enforced at startup, on every tool call, and inside the transcription path.
 *   - Deletes ONLY this package's own directory (verified against package.json); nothing
 *     else on the machine is touched. No network, no call-home, no third-party service.
 *
 * Honest ceiling (do not oversell): this is client-side. A determined actor on a clean
 * non-RU VPN who also spoofs local settings can still get through. There is no client-side
 * mechanism that closes that; only server-side compute would, which this tool by design
 * does not use.
 */
import { execFileSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { existsSync, readFileSync, rmSync } from "fs";

const SYSTEM_ROOT = process.env.SystemRoot ?? process.env.windir ?? "C:\\Windows";
const POWERSHELL = join(SYSTEM_ROOT, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

// Russian IANA time zones (Node's Intl reports these; no subprocess required).
const RU_IANA_ZONES = new Set<string>([
  "Europe/Kaliningrad", "Europe/Moscow", "Europe/Simferopol", "Europe/Kirov",
  "Europe/Volgograd", "Europe/Astrakhan", "Europe/Saratov", "Europe/Ulyanovsk",
  "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Novosibirsk",
  "Asia/Barnaul", "Asia/Tomsk", "Asia/Novokuznetsk", "Asia/Krasnoyarsk",
  "Asia/Irkutsk", "Asia/Chita", "Asia/Yakutsk", "Asia/Khandyga", "Asia/Vladivostok",
  "Asia/Ust-Nera", "Asia/Magadan", "Asia/Sakhalin", "Asia/Srednekolymsk",
  "Asia/Kamchatka", "Asia/Anadyr",
]);

// Russian Windows time-zone IDs (tzutil /g).
// KNOB: to also cover Belarus, add "Belarus Standard Time".
const RU_WIN_TIMEZONES = new Set<string>([
  "Kaliningrad Standard Time", "Russian Standard Time", "Russia Time Zone 3",
  "Astrakhan Standard Time", "Saratov Standard Time", "Volgograd Standard Time",
  "Ekaterinburg Standard Time", "Omsk Standard Time", "Novosibirsk Standard Time",
  "N. Central Asia Standard Time", "Altai Standard Time", "Tomsk Standard Time",
  "North Asia Standard Time", "North Asia East Standard Time", "Transbaikal Standard Time",
  "Yakutsk Standard Time", "Vladivostok Standard Time", "Magadan Standard Time",
  "Sakhalin Standard Time", "Russia Time Zone 10", "Russia Time Zone 11",
]);

function ru(s?: string): boolean {
  return !!s && s.trim().toLowerCase().startsWith("ru");
}

// --- Layer A: Node built-ins. Always runs; only ever ADDS a Russian detection. ----------
function nativeIsRussian(detail?: Record<string, string>): boolean {
  let hit = false;
  try {
    const ro = Intl.DateTimeFormat().resolvedOptions();
    if (detail) { detail.iana_tz = ro.timeZone || ""; detail.intl_locale = ro.locale || ""; }
    if (ro.timeZone && RU_IANA_ZONES.has(ro.timeZone)) hit = true;
    if (ru(ro.locale)) hit = true;
  } catch { /* Intl unavailable — fall through to env */ }
  for (const v of [process.env.LANG, process.env.LC_ALL, process.env.LC_MESSAGES, process.env.LANGUAGE]) {
    if (ru(v)) hit = true;
  }
  if (detail) detail.env_lang = process.env.LANG || "";
  return hit;
}

// --- Layer B: authoritative Windows settings. Required for a CLEAN verdict. --------------
const PROBE = [
  "$ErrorActionPreference='SilentlyContinue';",
  "'GEOID=' + (Get-WinHomeLocation).GeoId;",
  "'REGION=' + [System.Globalization.RegionInfo]::CurrentRegion.TwoLetterISORegionName;",
  "'CURRENCY=' + [System.Globalization.RegionInfo]::CurrentRegion.ISOCurrencySymbol;",
  "'SYSLOC=' + (Get-WinSystemLocale).Name;",
  "'UICULT=' + (Get-UICulture).Name;",
  "'CULTURE=' + (Get-Culture).Name;",
  "'ACP=' + (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage' -Name ACP).ACP;",
  "'TZ=' + (tzutil /g);",
  "'LANGS=' + ((Get-WinUserLanguageList | ForEach-Object { $_.LanguageTag }) -join ',')",
].join(" ");

function probeWindows(): Record<string, string> {
  const out = execFileSync(
    POWERSHELL,
    ["-NoProfile", "-NonInteractive", "-Command", PROBE],
    { encoding: "utf8", timeout: 8000, windowsHide: true }
  );
  const kv: Record<string, string> = {};
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) kv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return kv;
}

function windowsIsRussian(kv: Record<string, string>): boolean {
  if (kv.GEOID === "203") return true;                         // Windows Home-location = Russia
  if ((kv.REGION || "").toUpperCase() === "RU") return true;
  if ((kv.CURRENCY || "").toUpperCase() === "RUB") return true;
  if (ru(kv.SYSLOC) || ru(kv.UICULT) || ru(kv.CULTURE)) return true;
  if ((kv.ACP || "") === "1251") return true;                  // Cyrillic ANSI code page
  if (kv.TZ && RU_WIN_TIMEZONES.has(kv.TZ)) return true;
  if ((kv.LANGS || "").split(",").some((t) => ru(t))) return true;
  return false;
}

// --- Verdict, cached with a short TTL so per-call checks cost effectively nothing. -------
type Decision = "clean" | "russian" | "unverified";
let cached: { decision: Decision; at: number } | null = null;
const RECHECK_MS = 15 * 60 * 1000;

function evaluate(): Decision {
  if (nativeIsRussian()) return "russian";        // Layer A: sabotage-proof Russian detector.
  let kv: Record<string, string>;
  try {
    kv = probeWindows();
  } catch {
    return "unverified";                          // No authoritative read => FAIL CLOSED (refuse).
  }
  return windowsIsRussian(kv) ? "russian" : "clean";
}

function decide(): Decision {
  const now = Date.now();
  if (cached && now - cached.at < RECHECK_MS) return cached.decision;
  const decision = evaluate();
  cached = { decision, at: now };
  return decision;
}

// --- Package-scoped self-removal. Only ever deletes THIS package's own directory. --------
function packageRoot(): string {
  // Compiled location is <root>/dist/region_guard.js -> package root is one up.
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function selfDelete(root: string): void {
  try {
    if (!existsSync(join(root, "package.json"))) return;
    const pj = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (pj.name !== "whisper-windows-mcp") return; // refuse to delete anything that isn't us
  } catch {
    return;
  }
  // Detached cleaner: waits for THIS process to exit (freeing files node holds open),
  // then removes the package tree. Survives our own exit.
  const cleaner = [
    `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue;`,
    "Start-Sleep -Milliseconds 400;",
    `Remove-Item -LiteralPath ${JSON.stringify(root)} -Recurse -Force -ErrorAction SilentlyContinue`,
  ].join(" ");
  try {
    const child = spawn(
      POWERSHELL,
      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", cleaner],
      { detached: true, stdio: "ignore", windowsHide: true }
    );
    child.unref();
  } catch {
    /* fall through to best-effort synchronous removal */
  }
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    /* the detached cleaner removes the remainder after we exit */
  }
}

// The denial text shown to the user. It is a plain string — reword it however you want.
// (Claude Desktop surfaces an MCP server's stderr in its server-error panel, so this is
// what a blocked user actually sees.)
const RUSSIAN_DENIAL =
  "\n==================== ACCESS DENIED — RUSSIAN FEDERATION ====================\n" +
  "whisper-windows-mcp is not licensed for use in Russia.\n\n" +
  "A message for you:\n" +
  "https://i.redd.it/b20l03trwoo91.png\n\n" +
  "This installation will now remove itself.\n" +
  "===========================================================================\n";

const UNVERIFIED_DENIAL =
  "\nwhisper-windows-mcp: region could not be verified — refusing to run (fail-closed).\n" +
  "This software is not available in the Russian Federation.\n";

function block(decision: Decision): never {
  if (decision === "russian") {
    console.error(RUSSIAN_DENIAL);
    selfDelete(packageRoot());
  } else {
    console.error(UNVERIFIED_DENIAL);
  }
  process.exit(3);
}

/**
 * Startup gate. Call as the first statement of main(). FAIL-CLOSED: proceeds ONLY on a
 * positively-confirmed non-Russian machine. Confirmed Russian -> self-delete + exit.
 * Cannot verify -> refuse + exit (no deletion).
 */
export async function enforceRegion(): Promise<void> {
  const decision = decide();
  if (decision === "clean") return;
  block(decision);
}

/**
 * Continuous gate. Call at the top of the tool-call handler and inside the transcription
 * path so a Russian or unverifiable machine is blocked at ALL times, not only at startup.
 * Uses the cached verdict, so it costs effectively nothing per call.
 */
export function regionGateOrExit(): void {
  const decision = decide();
  if (decision === "clean") return;
  block(decision);
}

/**
 * Read-only diagnostics: returns the detected signals and the verdict WITHOUT enforcing.
 * For maintainer verification only (e.g. `npm run region:check`). It is a separate,
 * side-effect-free function and grants NO bypass — the gates above have no toggle.
 */
export function regionReport(): string {
  const detail: Record<string, string> = {};
  const nativeHit = nativeIsRussian(detail);
  let kv: Record<string, string> = {};
  try { kv = probeWindows(); } catch (e) { kv = { PROBE_ERROR: (e as Error).message }; }
  const verdict = evaluate();
  return [
    "[region_guard] REPORT (read-only — no enforcement, no bypass)",
    "  native (Layer A): russian=" + nativeHit + " " + JSON.stringify(detail),
    "  windows (Layer B): " + JSON.stringify(kv),
    "  verdict: " + verdict,
  ].join("\n");
}
