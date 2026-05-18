// 01 — Hello world
//
// The smallest useful Copilot SDK program: construct a client, open a session,
// send one prompt, print the answer, shut the client down.
//
// Run: COPILOT_DISABLE_MCP=1 mvn -q exec:java -Dexec.mainClass=examples.copilot.HelloWorld
//
// COPILOT_DISABLE_MCP=1 keeps this example on the bare SDK surface — no
// user-configured MCP servers loaded by the underlying CLI subprocess. The
// JVM cannot mutate its own environment, so the variable must be exported in
// the parent shell. The setProperty mirror below is for any SDK code that
// also consults JVM system properties.
package examples.copilot;

import com.github.copilot.sdk.CopilotClient;
import com.github.copilot.sdk.CopilotSession;
import com.github.copilot.sdk.generated.AssistantMessageEvent;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

public final class HelloWorld {
  public static void main(String[] args) throws Exception {
    System.setProperty("copilot.disable.mcp", "1");
    try (CopilotClient client = new CopilotClient()) {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      AssistantMessageEvent response = session.sendAndWait(
          new MessageOptions().setPrompt("What is 2 + 2?")
      ).get();

      System.out.println(response.getData().content());
    }
  }
}
