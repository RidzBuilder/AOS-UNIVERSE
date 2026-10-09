import { execFileSync } from "node:child_process";
import fs from "node:fs";

const baseRef = process.env.AOS_BOUNDARY_BASE_REF || "origin/main";
const run = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const errors = [];

try {
  run(["merge-base", "--is-ancestor", baseRef, "HEAD"]);
} catch {
  console.error(JSON.stringify({
    check_id: "AOS-REPOSITORY-BOUNDARY-001",
    result_state: "BLOCKED",
    reason: "base_ref_not_available_or_not_ancestor",
    base_ref: baseRef
  }, null, 2));
  process.exit(2);
}

const diffRange = baseRef + "...HEAD";
const changed = run(["diff", "--name-only", "-z", diffRange).split("\0").filter(Boolean);
const contentPaths = run(["diff", "--name-only", "--diff-filter=ACMR", "-z", diffRange).split("\0").filter(Boolean);

const allowedPrefixes = [
  ".github/", "GOVERNANCE/", "governance/", "docs/", "scripts/", "src/", "tests/"
];

for (const path of changed) {
  if (path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
    errors.push({ path, reason: "unsafe_or_noncanonical_path" });
    continue;
  }
  if (allowedPrefixes.some((prefix) => path.startsWith(prefix))) continue;
  if (!path.includes("/")) {
    try {
      run(["cat-file", "-e", baseRef + ":" + path]);
      continue;
    } catch {
      errors.push({ path, reason: "new_root_file_not_allowed" });
      continue;
    }
  }
  errors.push({ path, reason: "path_outside_aos_allowlist" });
}

const markerGroups = [
  ["AA", "FA"], ["FS", "DW"], ["PO", "ROS"], ["TEN", "TOR"],
  ["Affi", "liate"], ["NARA", "VA"], ["Digital", "-Marketer"], ["GAP", "-MX-"]
].map((parts) => parts.join(""));

for (const path of contentPaths) {
  if (!fs.existsSync(path) || !fs.statSync(path).isFile()) continue;
  let content;
  try {
    content = run(["show", "HEAD:" + path]);
  } catch {
    errors.push({ path, reason: "changed_file_content_unreadable" });
    continue;
  }
  for (const marker of markerGroups) {
    if (content.toLowerCase().includes(marker.toLowerCase())) {
      errors.push({ path, reason: "cross_project_marker_in_changed_content", marker_class: marker });
    }
  }
}

const report = {
  check_id: "AOS-REPOSITORY-BOUNDARY-001",
  result_state: errors.length ? "FAIL" : "PASS",
  base_ref: baseRef,
  changed_path_count: changed.length,
  scanned_content_count: contentPaths.length,
  allowed_prefixes: allowedPrefixes,
  errors
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
