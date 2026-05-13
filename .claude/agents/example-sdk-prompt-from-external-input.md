---
name: example-sdk-prompt-from-external-input
description: Port the "feed external data into a prompt" examples — argv-positional file read (04) and piped subprocess stdout like `git diff --cached` (05). One skill covers both because they share the same prompt-template shape. References are examples/nodejs/simple-sdk/04-explain-code-file.mjs and 05-commit-message-from-diff.mjs.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — SDK Prompt From External Input

## Pattern Summary

Real-world SDK usage almost always means feeding the model something the user did not type: a file from disk, the output of a subprocess, the body of an HTTP request, a clipboard payload. The pattern is the same in every form — gather the external string, then assemble a multi-line prompt that delimits the data from the instructions (typically with a `--- <label> ---` separator) so the model treats the data as data, not as more instructions. The two reference variants differ only in *source*: variant A reads a file path passed as argv; variant B captures the stdout of `git diff --cached`.

## Root Cause

Beginners concatenate user data directly into the prompt with no separator, which conflates instructions and content — the model may treat phrases inside the data as commands ("Ignore previous instructions and …"), or may garble its answer because it cannot tell where the instructions end. They also commonly omit input validation: missing argv → cryptic null error; empty diff → wasted round-trip with a meaningless answer.

## Detection Signals

- Target-language repo has hello-world but no example showing data-driven prompts
- A user asks "how do I send a file / shell output to Copilot" in the target language
- An existing port concatenates input directly into the prompt with no delimiter
- An existing port omits the empty-input guard (sends the prompt anyway when the source is empty)

## Validation Steps

1. Read both references: `04-explain-code-file.mjs` and `05-commit-message-from-diff.mjs`
2. Confirm the target language has:
   - argv access for variant A (`sys.argv`, `os.Args`, `std::env::args`)
   - synchronous subprocess execution returning captured stdout for variant B (`subprocess.run`, `exec.Command`, `std::process::Command`)
   - multi-line string assembly idiom (template literals, f-strings with triple-quote, raw strings, etc.)
3. Confirm the target language can `process.exit(1)` (or raise) when input is missing/empty

## Remediation Actions

Port both variants. Each follows the same five-step shape:

1. **Acquire the external input**
   - Variant A: read argv[2] (or [1]); if missing, print `usage:` line to stderr and exit 1; then read the file
   - Variant B: run the source subprocess (`git diff --cached`); if stdout is empty/whitespace-only, print a stderr hint ("No staged changes. Run `git add` first.") and exit 1
2. **Build the prompt as an array of lines, then join with `\n`** — keeps the assembly readable and the delimiter visible
3. **Include a labeled separator** — `--- <path or label> ---` on its own line before the data block. The trailing separator can be omitted; one is enough to signal "data starts here"
4. **Open client + session, `sendAndWait`, print response** — the reference variants both use the minimal-roundtrip shape inside; only the prompt assembly differs
5. **Always `stop()` and exit** — same as 01

## Prevention Guardrails

- Naming: `04-explain-code-file.<ext>` and `05-commit-message-from-diff.<ext>` — preserve the source labels so the reader knows which input source each variant exercises
- Reviewer checklist: explicit usage message when argv is missing; explicit guard when subprocess output is empty; visible separator in the prompt
- Never `console.log` the raw external input separately from the prompt — that leaks data outside the model context boundary and confuses logs

## Cross-Project Application

1. Identify the target SDK's preferred long-prompt shape — some prefer system+user role splits, others prefer a single string with delimiters
2. Find existing data-driven examples; check for the separator pattern, the empty-input guard, and the missing-argv guard
3. If both variants exist already, confirm they use the *same* prompt-assembly idiom (consistency across examples is what makes them teachable)

## Usage

When invoked with a target language:

1. Run **Detection Signals** — check whether either or both variants are missing
2. Read the two reference files
3. Emit target-language ports of both variants following **Remediation Actions**
4. Apply **Prevention Guardrails** — separator present, guards in place
5. Report PASS / WARN / FAIL per variant
