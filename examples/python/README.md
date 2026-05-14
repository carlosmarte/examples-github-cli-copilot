# Python examples — `github-copilot-sdk`

Six Python ports of the canonical Copilot SDK patterns. Each example is a
single self-contained async script; the Node twins live in
`../nodejs/simple-sdk/`, the Java twins in `../java/`.

## Prerequisites

1. **Python 3.11+** — the SDK requires `>=3.11`.
2. **GitHub Copilot CLI 1.0.17+, authenticated** — the SDK launches it as a
   subprocess, identical to the Node and Java SDKs.
   ```sh
   copilot --version       # 1.0.17 or newer
   copilot auth status     # must report logged in
   ```

## Install

With `uv` (recommended):

```sh
uv sync
```

Or plain `pip`:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Layout

```
examples/python/
├── pyproject.toml
├── requirements.txt
├── README.md
├── 01-hello-world.py
├── 02-multi-turn-conversation.py
├── 03-streaming-deltas.py
├── 04-explain-code-file.py
├── 05-commit-message-from-diff.py
└── 06-graceful-shutdown.py
```

## Running

```sh
python 01-hello-world.py
python 02-multi-turn-conversation.py
python 03-streaming-deltas.py
python 04-explain-code-file.py 01-hello-world.py
python 05-commit-message-from-diff.py
python 06-graceful-shutdown.py
```

## API surface used

| Node (`@github/copilot-sdk`)            | Python (`github-copilot-sdk`)                                       |
| --------------------------------------- | ------------------------------------------------------------------- |
| `new CopilotClient()`                   | `CopilotClient()` (then `await client.start()`)                     |
| `client.createSession({ model, … })`    | `await client.create_session(model=..., on_permission_request=...)` |
| `session.sendAndWait({ prompt })`       | `await session.send_and_wait(prompt)`                               |
| `response?.data.content`                | `isinstance(reply.data, AssistantMessageData)` → `reply.data.content` |
| `session.on("assistant.message_delta")` | `session.on(handler)` + `isinstance(event.data, AssistantMessageData)` |
| `await client.stop()`                   | `await client.stop()`                                               |

## Notes

- The Python SDK is fully `async`/`await`. Every example is wrapped in
  `asyncio.run(main())`.
- There is no string-keyed event subscription like Node's
  `session.on("assistant.message_delta", …)`. Instead, register a single
  handler with `session.on(handler)` and dispatch on the event's `data` type
  (`AssistantMessageData`, `SessionIdleData`, etc.).
- `PermissionHandler.approve_all` auto-approves any permission prompts the
  SDK emits — fine for examples, not for production.
- Pinned to `github-copilot-sdk>=0.1.0`. The package is currently in alpha;
  bump as new releases land.
