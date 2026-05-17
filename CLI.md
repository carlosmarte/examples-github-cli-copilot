# GitHub Copilot CLI — non-interactive one-shot tasks (scripting/automation) or interactive sessions started with immediate context.

> **Note.** In late 2025, GitHub deprecated the older `gh copilot` extension
> (limited to `suggest` and `explain`) in favor of the new, fully agentic
> **GitHub Copilot CLI**, invoked simply as `copilot`. This new CLI behaves
> very much like Claude Code — it has tool dispatch, file editing, plan
> mode, custom personas, and slash commands.

## 1. One-Shot Executions (Programmatic Mode)

If you want Copilot to take a prompt, perform the action, output the result,
and immediately exit back to your shell, use the `-p` (or `--prompt`) flag.
This is **programmatic mode** and is ideal for scripting.

### Basic one-shot

Bash

```
copilot -p "Summarize the last 5 git commits and format them as a markdown list"
```

### Piping input

Pipe standard output directly into Copilot for one-shot analysis:

Bash

```
cat error.log | copilot -p "Find the stack trace and explain the root cause"
```

### Fully automated (the YOLO flag)

By default, Copilot pauses to ask before running shell commands, creating
files, or editing code. In CI / headless contexts, bypass approvals with
`--allow-all-tools` (alias `--yolo`, alias `--allow-all`):

Bash

```
copilot -p "Find all deprecated API calls in src/ and update them" --allow-all-tools
```

Combine `-p` and `--allow-all-tools` for the canonical CI invocation.

---

## 2. Providing Instructions at Startup (System Prompts)

Unlike Claude Code, which takes inline `--system-prompt` / `--append-system-prompt`
flags, GitHub Copilot prefers to **inject context from files**.

### Repository-wide instructions

To make Copilot always follow your formatting constraints or guardrails
whenever it is launched in a directory, create an instructions file:

- Place your rules in `.github/copilot-instructions.md` at the repo root.
- Copilot auto-loads it on startup. (e.g. *"Always use TypeScript, prefer
  arrow functions, ensure all responses follow JSend."*)

This is the closest analog to Claude's `--append-system-prompt`, except
checked into the repo so every contributor and CI run inherits the same
rules.

### Ad-hoc file injection (`@<path>`)

If you have a specific instructions file you only want for one run, inject
it inline using Copilot's `@` syntax:

Bash

```
copilot -p "@./.github/prompts/strict-audit.md Review auth.js"
```

The `@./relative/path.md` token is replaced at launch by the file's literal
contents before the prompt is sent to the model. Use this for one-off
guardrails (output format, tone, persona) that you don't want to commit to
the repo.

---

## 3. Implementing Few-Shot Prompting (Custom Personas)

For complex tasks that require few-shot examples (Input → Output pairs
guiding model behavior), Copilot uses configuration files rather than inline
JSON strings.

### Custom personas via AGENTS.md

Define specialized roles in an `AGENTS.md` file at the repo root. The CLI
discovers it on startup, alongside `.github/copilot-instructions.md`, and
makes those personas selectable inside the session. See the
[AGENTS.md spec](https://agentmd.org/) for the canonical structure.

### Ad-hoc few-shot via `@file`

For a one-off invocation that doesn't need to live in the repo, write the
few-shot pairs in a markdown file and inject with `@`:

Bash

```
copilot -p "@./prompts/cleaner.md

Snippet to rewrite:
try { db.connect(); } catch(e) { console.log(e); }" --allow-all-tools
```

Where `prompts/cleaner.md` looks like:

```markdown
You are a strict code formatter. Apply this transformation exactly, with no
commentary, no preamble, and no markdown fences. Output ONLY the rewritten
code.

Input:  catch (e) { console.log(e); }
Output: catch (error) { logger.error({ error }, "operation failed"); }

Input:  catch(err) { console.error('bad', err); }
Output: catch (error) { logger.error({ error }, "unexpected failure"); }
```

This is the Copilot equivalent of Claude's `--agents '<json>' --agent <name>`
— same outcome, file-based rather than JSON-arg-based.

### Plan mode

Copilot also ships with a built-in **plan agent**. If you want it to map out
a step-by-step implementation plan *before* writing any code, pass `--plan`:

Bash

```
copilot --plan "Refactor the database connection logic to use connection pooling"
```

The agent will respond with a numbered plan, then either pause for review
(interactive) or proceed (`--allow-all-tools`).

---

## 4. Interactive Start (Prompt on Launch)

If you want to immediately kick off a task but **remain inside the interactive
chat UI** so you can steer the agent or answer clarifying questions, drop
the `-p` flag:

Bash

```
copilot "Investigate why the test suite is failing"
```

Once inside the interactive session, slash commands switch modes on the fly:

| Command          | What it does                                                  |
| ---------------- | ------------------------------------------------------------- |
| `/plan`          | Map out next steps before touching code                       |
| `/yolo`          | Auto-approve the rest of the session's tool calls             |
| `/review`        | Have the agent re-check its own work against the original ask |
| `/model <name>`  | Switch the session to a different model (also updates default) |
| `/models`        | List models your org / account has access to                  |

You can also inline `@./path/to/file` at any time inside an interactive
prompt — same file-injection semantics as the `-p` form.

---

## 5. Model Selection

The Copilot CLI defaults to whatever model you (or your org admin) have set
as your active default. Override per-invocation in three ways, ordered from
most-ergonomic-inside-a-session to most-deterministic-for-CI:

### 5a. Interactive mode (slash command)

Inside an active Copilot CLI session:

```
/models                 # list available models
/model gpt-5            # switch this session AND update persistent default
```

> The `/model` slash command also writes the choice to your user config, so
> the next launch starts with that model.

### 5b. Command-line flag

Override your default model right from the terminal — perfect for one-shot
calls or starting a new session with a specific model:

Bash

```
copilot --model claude-sonnet "Refactor this Python script to use FastAPI"
```

### 5c. Environment variable (best for scripts / CI)

For headless environments, automated agent harnesses, or shell aliases,
an env var is the most bulletproof method because it composes cleanly with
process supervisors and `env` injection:

Bash

```
COPILOT_MODEL=gpt-5-mini copilot -p "Run the test suite and summarize errors"
```

`COPILOT_MODEL` overrides any default in your user config but is itself
overridden by an explicit `--model` flag, giving you the standard
**config < env < flag** precedence chain.

---

## Cheat sheet

| Goal                                | Invocation                                                          |
| ----------------------------------- | ------------------------------------------------------------------- |
| One-shot prompt, exit               | `copilot -p "<prompt>"`                                             |
| One-shot, auto-approve tools (CI)   | `copilot -p "<prompt>" --allow-all-tools`                           |
| Pipe stdin into one-shot            | `cat err.log \| copilot -p "<prompt>"`                              |
| Interactive with seed prompt        | `copilot "<prompt>"`                                                |
| Plan first, then act                | `copilot --plan "<prompt>"` (or `/plan` inside)                     |
| One-run instructions / guardrails   | `copilot -p "@./rules.md <user prompt>"`                            |
| Repo-wide instructions              | Commit `.github/copilot-instructions.md`                            |
| Custom few-shot persona (ad-hoc)    | `copilot -p "@./prompts/persona.md <user prompt>"`                  |
| Custom persona (committed)          | Define in `AGENTS.md` at repo root                                  |
| Switch model (one-shot)             | `copilot --model gpt-5 -p "<prompt>"`                               |
| Switch model (env, scripts/CI)      | `COPILOT_MODEL=gpt-5-mini copilot -p "<prompt>"`                    |
| Switch model (inside session)       | `/model gpt-5`                                                      |

See [`examples/cli/`](examples/cli/) for working one-shot, few-shot, and
startup examples in bash, Node, Python, Go, Java, and Rust.
