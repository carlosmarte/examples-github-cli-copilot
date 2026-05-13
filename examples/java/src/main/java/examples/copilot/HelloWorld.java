// 01 — Hello world
//
// The smallest useful Copilot SDK program: construct a client, open a session,
// send one prompt, print the answer, shut the client down.
//
// Run: mvn -q exec:java -Dexec.mainClass=examples.copilot.HelloWorld
package examples.copilot;

import com.github.copilot.sdk.CopilotClient;
import com.github.copilot.sdk.CopilotSession;
import com.github.copilot.sdk.generated.AssistantMessageEvent;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

public final class HelloWorld {
  public static void main(String[] args) throws Exception {
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
