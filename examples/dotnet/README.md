# .NET (C#) examples — `GitHub.Copilot.SDK`

Six C# ports of the canonical Copilot SDK patterns. Each example is its own
top-level-statement `Program.cs` in a one-file csproj; the Node twins live in
`../nodejs/simple-sdk/`, the Java twins in `../java/`, the Python twins in
`../python/`, the Go twins in `../go/`, the Rust twins in `../rust/`.

## Prerequisites

1. **.NET 8 SDK or later** — verify with `dotnet --info`.
2. **GitHub Copilot CLI 1.0.17+, authenticated** — the SDK launches it as a
   subprocess, identical to the other-language SDKs.
   ```sh
   copilot --version       # 1.0.17 or newer
   copilot auth status     # must report logged in
   ```

## Layout

```
examples/dotnet/
├── Directory.Build.props             # shared TargetFramework + PackageReference
├── README.md
├── HelloWorld/
│   ├── HelloWorld.csproj
│   └── Program.cs                    # 01 — one prompt, one response
├── MultiTurn/                        # 02 — one session, sequential prompts
├── StreamingDeltas/                  # 03 — session.On + AssistantMessageDeltaEvent
├── ExplainCodeFile/                  # 04 — file → labeled-separator prompt
├── CommitFromDiff/                   # 05 — git diff --cached → prompt
└── GracefulShutdown/                 # 06 — StopAsync on success / throw / signal
```

`Directory.Build.props` pins `<TargetFramework>net8.0</TargetFramework>`,
enables nullable + implicit usings, and adds the
`<PackageReference Include="GitHub.Copilot.SDK" Version="*-*" />`. Each
per-example `.csproj` only overrides `<AssemblyName>`.

## Restore & run

```sh
dotnet restore

dotnet run --project HelloWorld
dotnet run --project MultiTurn
dotnet run --project StreamingDeltas
dotnet run --project ExplainCodeFile -- HelloWorld/Program.cs
dotnet run --project CommitFromDiff
dotnet run --project GracefulShutdown
```

## API surface used

| Node (`@github/copilot-sdk`)            | .NET (`GitHub.Copilot.SDK`)                                            |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `new CopilotClient()`                   | `new CopilotClient()` + `await client.StartAsync()` (`IAsyncDisposable`) |
| `client.createSession({ model, … })`    | `await client.CreateSessionAsync(new SessionConfig { Model = …, OnPermissionRequest = … })` |
| `session.sendAndWait({ prompt })`       | `await session.SendAsync(new MessageOptions { Prompt = … })`           |
| `response?.data.content`                | `response?.Data.Content`                                               |
| `session.on("assistant.message_delta")` | `session.On(evt => switch evt { AssistantMessageDeltaEvent d: … })`    |
| `session.on("session.idle")`            | `case SessionIdleEvent:` inside the same switch                        |
| `await client.stop()`                   | `await client.StopAsync()` (or `await using` for auto-dispose)         |

## Notes

- `OnPermissionRequest` is **required** on `SessionConfig`. The examples use
  `PermissionHandler.ApproveAll` — fine for examples, not for production.
- `await using` on `CopilotClient` runs `DisposeAsync` (which calls
  `StopAsync` internally), giving you Java's try-with-resources semantics
  without a manual `finally`.
- The streaming example uses a single `TaskCompletionSource` to bridge the
  `SessionIdleEvent` callback into an `await` — the C# equivalent of the
  Node twin's `new Promise(resolve => session.on("session.idle", resolve))`.
- The graceful-shutdown example registers `Console.CancelKeyPress` (Ctrl-C
  → 130) and `PosixSignalRegistration.Create(PosixSignal.SIGTERM, …)` (→ 143).
  `Interlocked.Exchange` guards `StopAsync` so the signal handler and the
  happy-path call never race.
- `GitHub.Copilot.SDK` is pinned with the floating prerelease range
  `Version="*-*"`. Pin to a specific version once the SDK reaches stable, or
  swap to `Version="*"` if you only want stable releases.
