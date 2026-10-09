# AOS UNIVERSE — Repository Integrity & Boundary Hardening 001

Status: PROPOSED THROUGH REVIEW; NOT MERGED
Baseline commit: d997637d6d81cc5fed0acc3ae1ec5d03cfa8c28f
Stage 18: NOT ACCEPTED / BLOCKED (unchanged)
Fundamental Specification v1.0: FINAL / LOCKED (unchanged)

## Scope

This change proposes repository-local guardrails, CI validation, review ownership, accurate repository status text, and an explicit execution authorization boundary. It does not change any GAP or Stage status and does not authorize deployment, provider activation, or merge.

## Baseline Findings

- The repository has both uppercase and lowercase governance directories. Inventory found two canonical AOS governance files in the uppercase directory and one unrelated governance artifact in the lowercase directory.
- The unrelated artifact is removed from the active tree in this proposal. Its original Git blob remains identifiable in repository history as bc27d992c0d152df2c71fd18a29f3544db54dde9; this is a reversible PR change, not a history rewrite.
- The README still described an empty-repository bootstrap despite implementation, harness, and scoped runtime evidence being present.
- The existing workflow did not install project dependencies before invoking the TypeScript compiler.
- The lint command used a removed Next.js lint subcommand and no ESLint configuration/dependency was present.
- The R8 runner intentionally reported two structural PASS and ten runtime/E2E BLOCKED. Ordinary build success must not be interpreted as full conformance.
- The branch listing reported main as unprotected and the repository rulesets endpoint returned no rulesets. The GitHub connection could not read branch protection details; repository administration must configure and verify protection separately.
- The controlled conformance endpoint could execute side effects when queried with execute=1 and had no explicit in-handler authorization check in the baseline source.
- Code search returned no indexed matches for several contamination markers, but this is not an exhaustive history or secret scan.

## Controls Proposed

1. Check changed paths against the approved directory allowlist; new root-level files are rejected.
2. Scan added/modified content for cross-project markers before the PR can pass CI.
3. Run dependency installation before validation, TypeScript, lint, and production build.
4. Add a strict R8 acceptance mode that exits nonzero when any required runtime/E2E family is BLOCKED. It is an explicit dispatch gate and is separate from the ordinary build.
5. Add repository-wide CODEOWNERS. This is advisory until branch protection or a ruleset requires review.
6. Require a configured AOS_CONTROL_PLANE_TOKEN bearer token before a request can start controlled conformance execution. Missing token fails closed. Do not add the token value to source control.
7. Keep the existing Inngest SDK route unchanged pending independent signature/authentication verification.
8. Preserve all current GAP and Stage status decisions.

## Required Repository Administration

The repository API reported main unprotected and no rulesets. The active connector could not access the branch-protection endpoint, so no administrative setting was changed.

After review, the repository owner must configure branch protection/rulesets in GitHub Settings → Rules → Rulesets (or Branches → Branch protection rules):
- target main;
- require pull requests before merging;
- require at least one approving review;
- require CODEOWNERS review;
- require the AOS Repository Integrity and Conformance / integrity-and-conformance check;
- require the branch to be up to date if appropriate for the repository workflow;
- block force pushes and branch deletion;
- do not allow bypass for routine automation;
- keep merge and deployment as separate approval gates.

These settings must be verified in GitHub after configuration. This document does not claim that they are already active.

## Environment Configuration Needed Before Controlled Execution

Configure AOS_CONTROL_PLANE_TOKEN in the intended Vercel environment through the provider secret-management UI. Use a high-entropy secret, keep it out of source control, and test both missing-token and invalid-token denial before an authorized positive execution. No deployment or production execution is performed by this PR.

## Explicit Non-Claims

- No secret leakage has been confirmed by this audit.
- No exhaustive repository-history secret scan has been completed.
- No full runtime conformance family is promoted to PASS by this change.
- No GAP status, Stage status, provider activation, or deployment authorization is changed.
- No merge or deployment is authorized by this proposal.

## Review Checklist

- [ ] Inspect the full PR diff and confirm only AOS-scoped paths are affected.
- [ ] Confirm the quarantined artifact is absent from the active tree and remains recoverable through Git history.
- [ ] Confirm CI passes path and contamination boundary checks.
- [ ] Confirm CI installs dependencies before TypeScript/lint/build.
- [ ] Confirm the strict R8 gate fails while any family remains BLOCKED.
- [ ] Confirm missing/invalid control-plane token denies execution.
- [ ] Configure and independently verify branch protection/rulesets.
- [ ] Reconcile conflicting GAP-RD-05/GAP-RD-07 evidence chronology without silently changing statuses.
