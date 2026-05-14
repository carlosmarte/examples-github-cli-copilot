// 01 — Hello world
//
// The smallest useful Copilot SDK program: open a client, create a session,
// send one prompt, print the answer, shut the client down. `await using`
// ensures CopilotClient.DisposeAsync runs even on throw.
//
// Run: dotnet run --project HelloWorld

using GitHub.Copilot.SDK;

await using var client = new CopilotClient();
await client.StartAsync();

var session = await client.CreateSessionAsync(new SessionConfig
{
    Model = "gpt-4.1",
    OnPermissionRequest = PermissionHandler.ApproveAll,
});

var response = await session.SendAsync(new MessageOptions { Prompt = "What is 2 + 2?" });
Console.WriteLine(response?.Data.Content);
