# examples-github-cli-copilot

Runnable examples of [`@github/copilot-sdk`](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started)
usage patterns. Each script is standalone — pick the one closest to what you
want and adapt.

## Setup

The SDK shells out to the GitHub Copilot CLI, so install and authenticate that
first:

```sh
# install Copilot CLI per GitHub docs, then verify:
copilot --version

# install the SDK
npm install
```

## Examples

| # | Script | What it shows |
| - | ------ | ------------- |
| 1 | [`examples/01-hello-world.mjs`](examples/01-hello-world.mjs) | Smallest possible round-trip: client → session → `sendAndWait` → `stop`. |
| 2 | [`examples/02-multi-turn-conversation.mjs`](examples/02-multi-turn-conversation.mjs) | One session, several sequential prompts that build on each other. |
| 3 | [`examples/03-streaming-deltas.mjs`](examples/03-streaming-deltas.mjs) | `streaming: true` plus `session.on("assistant.message_delta", …)` to print chunks live, and `session.idle` to know when the response is done. |
| 4 | [`examples/04-explain-code-file.mjs`](examples/04-explain-code-file.mjs) | Read a file off disk and ask Copilot to explain it. Pass the path as an argv. |
| 5 | [`examples/05-commit-message-from-diff.mjs`](examples/05-commit-message-from-diff.mjs) | Pipe `git diff --cached` into Copilot and get back a Conventional Commits message. |
| 6 | [`examples/06-graceful-shutdown.mjs`](examples/06-graceful-shutdown.mjs) | Wrap the work in `try/finally` and hook `SIGINT`/`SIGTERM` so `client.stop()` always runs. |

## Run

```sh
npm run ex:hello
npm run ex:multi-turn
npm run ex:streaming
npm run ex:explain -- examples/01-hello-world.mjs
npm run ex:commit-msg
npm run ex:graceful
```

## API surface used

Only methods documented in the [Getting Started guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started):

- `new CopilotClient()` — construct the client
- `client.createSession({ model, streaming? })` — open a session
- `session.sendAndWait({ prompt })` — send a prompt, await the full response
- `session.on(eventType, handler)` — subscribe to `assistant.message_delta` / `session.idle`; returns an unsubscribe fn
- `response?.data.content` — the assistant's text
- `client.stop()` — close the underlying CLI process
