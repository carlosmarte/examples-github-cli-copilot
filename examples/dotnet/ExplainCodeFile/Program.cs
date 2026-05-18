// 04 — Explain a code file
//
// Read a file from disk and ask Copilot for a plain-English explanation.
//
// Run: dotnet run --project ExplainCodeFile -- <path-to-source-file>
// e.g. dotnet run --project ExplainCodeFile -- HelloWorld/Program.cs

using GitHub.Copilot.SDK;

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
Environment.SetEnvironmentVariable("COPILOT_DISABLE_MCP", "1");

if (args.Length < 1 || string.IsNullOrEmpty(args[0]))
{
    Console.Error.WriteLine("usage: dotnet run --project ExplainCodeFile -- <file>");
    Environment.Exit(1);
}

var target = args[0];
var source = await File.ReadAllTextAsync(target);

var prompt = string.Join("\n",
    "Explain what this file does in 4-6 bullet points.",
    "Call out anything subtle (race conditions, hidden side effects, error swallowing).",
    "",
    $"--- {target} ---",
    source);

await using var client = new CopilotClient();
await client.StartAsync();

var session = await client.CreateSessionAsync(new SessionConfig
{
    Model = "gpt-4.1",
    OnPermissionRequest = PermissionHandler.ApproveAll,
});

var response = await session.SendAsync(new MessageOptions { Prompt = prompt });
Console.WriteLine(response?.Data.Content);
