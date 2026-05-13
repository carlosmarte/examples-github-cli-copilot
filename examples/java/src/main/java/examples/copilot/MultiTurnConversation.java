// 02 — Multi-turn conversation
//
// One session, multiple sequential prompts. The session keeps prior turns as
// context, so the second prompt can refer to the first answer.
//
// Run: mvn -q exec:java -Dexec.mainClass=examples.copilot.MultiTurnConversation
package examples.copilot;

import com.github.copilot.sdk.CopilotClient;
import com.github.copilot.sdk.CopilotSession;
import com.github.copilot.sdk.generated.AssistantMessageEvent;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

import java.util.List;

public final class MultiTurnConversation {
  public static void main(String[] args) throws Exception {
    List<String> turns = List.of(
        "Give me a one-line description of the Fibonacci sequence.",
        "Now write a Java method that returns the nth Fibonacci number.",
        "Add a memoized version below the first one."
    );

    try (CopilotClient client = new CopilotClient()) {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      for (String prompt : turns) {
        System.out.println();
        System.out.println(">>> " + prompt);
        System.out.println();

        AssistantMessageEvent response = session.sendAndWait(
            new MessageOptions().setPrompt(prompt)
        ).get();

        System.out.println(response.getData().content());
      }
    }
  }
}
