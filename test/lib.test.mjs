/**
 * Unit tests for the pure logic in src/lib.ts.
 * Run against the COMPILED artifact (dist/lib.js) so they test what actually ships.
 * Zero test dependencies — Node's built-in test runner + assert.
 *   npm test   (builds first, then runs these)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  coerceNum, writeJsonAtomic, estimateWordCount, stableStringify, opKeyFor, isInsideDir,
  isValidJobId, isValidBatchId,
  extractTranscriptFromLog, parseLastTimestamp, formatDuration, estimateSec, estimateTime,
} from "../dist/lib.js";

// --- #8: input coercion — bad input must never reach whisper-cli as NaN ---
test("coerceNum: valid numbers pass through", () => {
  assert.equal(coerceNum(5), 5);
  assert.equal(coerceNum("5"), 5);
  assert.equal(coerceNum(0), 0);
  assert.equal(coerceNum(-1.5), -1.5);
  assert.equal(coerceNum("0.2"), 0.2);
});
test("coerceNum: bad/non-finite input -> undefined", () => {
  for (const bad of ["abc", NaN, Infinity, -Infinity, undefined, {}, [], "", "   ", null, true, false])
    assert.equal(coerceNum(bad), undefined, `coerceNum(${String(bad)})`);
});

// --- #1: switch_model containment — the security boundary ---
test("isInsideDir: legit paths inside are allowed", () => {
  const parent = resolve("base", "models");
  assert.equal(isInsideDir(resolve(parent, "ggml-large.bin"), parent), true);
  assert.equal(isInsideDir(resolve(parent, "sub", "m.bin"), parent), true);
});
test("isInsideDir: SECURITY — sibling-prefix dir is rejected (the v2.3.0 escape)", () => {
  const parent = resolve("base", "models");
  assert.equal(isInsideDir(resolve("base", "models-evil", "payload.bin"), parent), false);
});
test("isInsideDir: traversal-out and parent-itself are rejected", () => {
  const parent = resolve("base", "models");
  assert.equal(isInsideDir(resolve(parent, "..", "evil.bin"), parent), false);
  assert.equal(isInsideDir(parent, parent), false); // strictly inside, not equal
});

// --- job/batch ID validation — the traversal boundary for job-file fs access ---
test("isValidJobId: accepts server-minted IDs only", () => {
  assert.equal(isValidJobId("job_1700000000000_a1b2c3d4"), true);
  assert.equal(isValidBatchId("batch_1700000000000_deadbeef"), true);
});
test("isValidJobId: SECURITY — traversal / malformed / wrong-tool IDs are rejected", () => {
  for (const bad of [
    "..\\..\\..\\Users\\E\\secret",
    "../../etc/passwd",
    "job_1700000000000_a1b2c3d4/../../evil",
    "job_1700000000000_A1B2C3D4",      // uppercase hex not minted
    "job_1700000000000_a1b2c3d",       // 7 hex chars
    "job_abc_a1b2c3d4",                // non-numeric epoch
    "batch_1700000000000_a1b2c3d4",    // batch ID is not a valid job ID
    "", "   ", undefined, null, 42, {},
  ]) {
    assert.equal(isValidJobId(bad), false, `isValidJobId(${String(bad)})`);
  }
  // and the mirror: a job ID must not satisfy the batch check
  assert.equal(isValidBatchId("job_1700000000000_a1b2c3d4"), false);
  assert.equal(isValidBatchId("..\\..\\secret"), false);
});

// --- #2: privacy-gate keying — confirming one op must never satisfy another ---
test("stableStringify: key order does not change the output", () => {
  assert.equal(
    stableStringify({ b: 1, a: 2, c: { y: 1, x: 2 } }),
    stableStringify({ c: { x: 2, y: 1 }, a: 2, b: 1 }),
  );
});
test("opKeyFor: identical (incl. reordered) args -> identical key", () => {
  assert.equal(
    opKeyFor("transcribe_audio", { file_path: "a.mp3", language: "en", privacy_mode: true }),
    opKeyFor("transcribe_audio", { privacy_mode: true, language: "en", file_path: "a.mp3" }),
  );
});
test("opKeyFor: changed param or tool -> different key (re-disclose)", () => {
  assert.notEqual(
    opKeyFor("transcribe_audio", { file_path: "a.mp3", language: "en" }),
    opKeyFor("transcribe_audio", { file_path: "a.mp3", language: "ja" }),
  );
  assert.notEqual(opKeyFor("transcribe_audio", { x: 1 }), opKeyFor("generate_subtitles", { x: 1 }));
});

// --- #5: atomic state write — must round-trip and never corrupt ---
test("writeJsonAtomic: round-trips valid JSON; repeated writes stay valid", () => {
  const p = resolve(tmpdir(), `wwmcp-test-${randomUUID()}.json`);
  try {
    const obj = { a: 1, nested: { b: [1, 2, 3] }, s: "héllo" };
    writeJsonAtomic(p, obj);
    assert.deepEqual(JSON.parse(readFileSync(p, "utf8")), obj);
    for (let i = 0; i < 25; i++) writeJsonAtomic(p, { i });
    assert.equal(JSON.parse(readFileSync(p, "utf8")).i, 24);
  } finally {
    if (existsSync(p)) unlinkSync(p);
  }
});

// --- whisper-cli log parsing — the brittle stdout-scraping contract ---
test("parseLastTimestamp: largest start time in whole seconds", () => {
  const log = [
    "loading model",
    "[00:00:05.000 --> 00:00:09.000]  hi",
    "[00:01:30.500 --> 00:01:35.000]  later",
    "noise",
  ].join("\n");
  assert.equal(parseLastTimestamp(log), 90);
  assert.equal(parseLastTimestamp(""), 0);
  assert.equal(parseLastTimestamp("no timestamps here"), 0);
});
test("extractTranscriptFromLog: keeps only timestamped lines", () => {
  const log = [
    "whisper_init: loading model",
    "[00:00:00.000 --> 00:00:02.000]  hello",
    "ggml_vulkan: noise",
    "[00:00:02.000 --> 00:00:04.000]  world",
  ].join("\n");
  assert.equal(
    extractTranscriptFromLog(log),
    "[00:00:00.000 --> 00:00:02.000]  hello\n[00:00:02.000 --> 00:00:04.000]  world",
  );
});

// --- display helpers ---
test("formatDuration: M:SS and H:MM:SS", () => {
  assert.equal(formatDuration(0), "?:??");
  assert.equal(formatDuration(5), "0:05");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(3661), "1:01:01");
});
test("estimateWordCount: counts across arbitrary whitespace", () => {
  assert.equal(estimateWordCount("one two three"), 3);
  assert.equal(estimateWordCount("  spaced   out  \n words "), 3);
  assert.equal(estimateWordCount(""), 0);
});

// --- foreground-timeout guard math: must NOT under-predict (the 9:47 regression) ---
test("estimateSec: fixed model-load cost + per-second transcribe (GPU load cheaper to amortize)", () => {
  assert.equal(estimateSec(600, true), 290);    // 110 load + 600*0.3
  assert.equal(estimateSec(600, false), 930);   // 30 load + 600*1.5
  assert.equal(estimateSec(0, true), 0);        // unknown duration -> no estimate
});
test("estimateSec: BOTH measured timeouts trip the 210s guard; the clip that worked does not", () => {
  // 7:29 (449s) ran 3:56 in reality — ~2 min of it just RELOADING large-v3, not transcribe speed.
  // The Boogie clip (1:26 = 86s) transcribed fine foreground, so it must stay under the guard.
  assert.ok(estimateSec(449, true) > 210, `7:29 got ${estimateSec(449, true)}s`);
  assert.ok(estimateSec(587, true) > 210, `9:47 got ${estimateSec(587, true)}s`);
  assert.ok(estimateSec(86, true) <= 210, `1:26 clip got ${estimateSec(86, true)}s (should run inline)`);
});
test("estimateTime: formats and handles unknown duration", () => {
  assert.equal(estimateTime(0, true), "?");
  assert.equal(estimateTime(60, true), "~2m");   // load dominates a short clip's wall-clock
  assert.equal(estimateTime(600, true), "~5m");
});
