// 03 — Streaming deltas
//
// Enable streaming on the session and subscribe to AssistantMessageEvent to
// print chunks as they arrive. SessionIdleEvent fires when the response is
// complete and the session is ready for the next prompt.
//
// Run: mvn -q exec:java -Dexec.mainClass=examples.copilot.StreamingDeltas
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
