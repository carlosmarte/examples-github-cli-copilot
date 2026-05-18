// 02 — Multi-turn conversation
//
// One session, multiple sequential prompts. The session keeps prior turns as
// context, so the second prompt can refer to the first answer.
//
// Run: dotnet run --project MultiTurn

using GitHub.Copilot.SDK;

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
Environment.SetEnvironmentVariable("COPILOT_DISABLE_MCP", "1");

string[] turns =
{
    "Give me a one-line description of the Fibonacci sequence.",
    "Now write a C# method that returns the nth Fibonacci number.",
    "Add a memoized version below the first one.",
};

await using var client = new CopilotClient();
await client.StartAsync();

var session = await client.CreateSessionAsync(new SessionConfig
{
    Model = "gpt-4.1",
    OnPermissionRequest = PermissionHandler.ApproveAll,
});

foreach (var prompt in turns)
{
    Console.WriteLine();
    Console.WriteLine($">>> {prompt}");
    Console.WriteLine();

    var response = await session.SendAsync(new MessageOptions { Prompt = prompt });
    Console.WriteLine(response?.Data.Content);
}
