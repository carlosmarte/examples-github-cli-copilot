// 03 — Streaming deltas
//
// Enable streaming on the session and subscribe to AssistantMessageEvent to
// print chunks as they arrive. SessionIdleEvent fires when the response is
// complete and the session is ready for the next prompt.
//
// Run: COPILOT_DISABLE_MCP=1 mvn -q exec:java -Dexec.mainClass=examples.copilot.StreamingDeltas
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
import com.github.copilot.sdk.generated.SessionIdleEvent;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

import java.io.Closeable;
import java.util.concurrent.CountDownLatch;

public final class StreamingDeltas {
  public static void main(String[] args) throws Exception {
    System.setProperty("copilot.disable.mcp", "1");
    try (CopilotClient client = new CopilotClient()) {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setStreaming(true)
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      Closeable offDelta = session.on(AssistantMessageEvent.class, event -> {
        String chunk = event.getData().content();
        if (chunk != null) {
          System.out.print(chunk);
          System.out.flush();
        }
      });

      CountDownLatch idle = new CountDownLatch(1);
      Closeable offIdle = session.on(SessionIdleEvent.class, event -> idle.countDown());

      try {
        session.sendAndWait(
            new MessageOptions().setPrompt("Write a haiku about garbage collection in Java.")
        ).get();
        idle.await();
      } finally {
        offDelta.close();
        offIdle.close();
      }

      System.out.println();
    }
  }
}
