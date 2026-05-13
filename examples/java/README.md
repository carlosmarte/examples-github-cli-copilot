# Java examples — `@github/copilot-sdk-java`

Six Java ports of the canonical Copilot SDK patterns. Each example is a single
self-contained `main` class; their Node twins live in `../nodejs/simple-sdk/`.

## Prerequisites

1. **JDK 17+** — the SDK targets Java 17 (`mvn -v` should show 17 or newer).
2. **Maven 3.9+** — `mvn -v` to check.
3. **GitHub Copilot CLI 1.0.17+, authenticated** — the SDK launches it as a
   subprocess, identical to the Node SDK.
   ```sh
   copilot --version       # 1.0.17 or newer
   copilot auth status     # must report logged in
   ```

## Layout

```
examples/java/
├── pom.xml
├── README.md
└── src/main/java/examples/copilot/
    ├── HelloWorld.java              # 01 — one prompt, one response
    ├── MultiTurnConversation.java   # 02 — one session, sequential prompts
    ├── StreamingDeltas.java         # 03 — streaming + SessionIdleEvent
    ├── ExplainCodeFile.java         # 04 — file → labeled-separator prompt
    ├── CommitMessageFromDiff.java   # 05 — git diff --cached → prompt
    └── GracefulShutdown.java        # 06 — stop() on success / throw / signal
```

## Running

Build once:

```sh
mvn -q -DskipTests package
```

Run any example with `mvn exec:java`, overriding `exec.mainClass`:

```sh
mvn -q exec:java -Dexec.mainClass=examples.copilot.HelloWorld
mvn -q exec:java -Dexec.mainClass=examples.copilot.MultiTurnConversation
mvn -q exec:java -Dexec.mainClass=examples.copilot.StreamingDeltas
mvn -q exec:java -Dexec.mainClass=examples.copilot.ExplainCodeFile \
       -Dexec.args="src/main/java/examples/copilot/HelloWorld.java"
mvn -q exec:java -Dexec.mainClass=examples.copilot.CommitMessageFromDiff
mvn -q exec:java -Dexec.mainClass=examples.copilot.GracefulShutdown
```

## API surface used

| Node (`@github/copilot-sdk`)             | Java (`com.github.copilot.sdk`)                                       |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `new CopilotClient()`                    | `new CopilotClient()` — implements `AutoCloseable`                    |
| *(implicit)*                             | `client.start().get()` — required before `createSession`              |
| `client.createSession({ model, … })`     | `client.createSession(new SessionConfig().setModel(...)).get()`       |
| `session.sendAndWait({ prompt })`        | `session.sendAndWait(new MessageOptions().setPrompt(...)).get()`      |
| `response?.data.content`                 | `response.getData().content()`                                        |
| `session.on("assistant.message_delta")`  | `session.on(AssistantMessageEvent.class, ev -> ...)`                  |
| `session.on("session.idle")`             | `session.on(SessionIdleEvent.class, ev -> ...)`                       |
| `await client.stop()`                    | `client.stop().get()` (or `client.close()` via try-with-resources)    |

## Notes

- All async methods return `CompletableFuture<T>`. The examples call `.get()`
  for the simplest possible flow; production code should use the non-blocking
  `thenCompose` / `thenAccept` chain or a virtual-thread executor.
- `PermissionHandler.APPROVE_ALL` auto-approves any permission prompts the SDK
  emits — fine for examples, not for production.
- Pinned to `copilot-sdk-java` `1.0.0-beta-java.3`. Bump in `pom.xml` (the
  `copilot.sdk.version` property) when a newer release lands.
