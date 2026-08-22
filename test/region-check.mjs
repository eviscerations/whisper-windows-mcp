// Read-only region-detection check.
// Prints the detected signals and the verdict WITHOUT enforcing anything.
// Run:  npm run region:check
// This imports the guard's diagnostics function only; it grants no bypass and the
// enforcement gates have no toggle.
import { regionReport } from "../dist/region_guard.js";

console.log(regionReport());
