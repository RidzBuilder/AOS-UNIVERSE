import { execFileSync } from "node:child_process";

try {
  const output = execFileSync(process.execPath, ["scripts/execute-conformance-r8.mjs"], { encoding: "utf8" });
  process.stdout.write(output);
  const report = JSON.parse(output);
  const blocked = (report.counts && report.counts.BLOCKED) || 0;
  const failed = (report.counts && report.counts.FAIL) || 0;
  if (failed > 0 || blocked > 0) {
    console.error(JSON.stringify({ gate: "R8-STRICT", result_state: "BLOCKED", blocked, failed }));
    process.exit(2);
  }
  console.log(JSON.stringify({ gate: "R8-STRICT", result_state: "PASS", blocked, failed }));
} catch (error) {
  console.error("strict_conformance_runner_failed");
  process.exit(1);
}
