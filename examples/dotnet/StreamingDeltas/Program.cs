// 03 — Streaming deltas
//
// Enable streaming on the session and subscribe via session.On to receive
// AssistantMessageDeltaEvent chunks as they arrive. SessionIdleEvent signals
// completion; a TaskCompletionSource bridges the event into an awaitable.
//
// Run: dotnet run --project StreamingDeltas

using GitHub.Copilot.SDK;

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
Environment.SetEnvironmentVariable("COPILOT_DISABLE_MCP", "1");

await using var client = new CopilotClient();
await client.StartAsync();

var session = await client.CreateSessionAsync(new SessionConfig
{
    Model = "gpt-4.1",
    Streaming = true,
    OnPermissionRequest = PermissionHandler.ApproveAll,
});

var idle = new TaskCompletionSource();
session.On(evt =>
{
    switch (evt)
    {
        case AssistantMessageDeltaEvent delta:
            Console.Write(delta.Data.DeltaContent);
            break;
        case SessionIdleEvent:
            idle.TrySetResult();
            break;
    }
});

await session.SendAsync(new MessageOptions { Prompt = "Write a haiku about C#'s async/await." });
await idle.Task;
Console.WriteLine();
