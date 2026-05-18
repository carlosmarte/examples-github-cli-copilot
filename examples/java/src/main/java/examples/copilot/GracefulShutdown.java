// 06 — Graceful shutdown
//
// `client.stop()` must run on success, on exception, and on SIGINT/SIGTERM —
// otherwise the underlying Copilot CLI subprocess can leak. Three paths,
// one shutdown helper:
//   1. happy path: finally block calls shutdown(0)
//   2. exception:  catch calls shutdown(1)
//   3. signal:     Runtime shutdown hook calls shutdown(130)
//
// Run: COPILOT_DISABLE_MCP=1 mvn -q exec:java -Dexec.mainClass=examples.copilot.GracefulShutdown
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

import java.util.concurrent.atomic.AtomicBoolean;

public final class GracefulShutdown {
  public static void main(String[] args) {
    System.setProperty("copilot.disable.mcp", "1");
    CopilotClient client = new CopilotClient();
    AtomicBoolean stopped = new AtomicBoolean(false);

    Runtime.getRuntime().addShutdownHook(new Thread(() -> shutdown(client, stopped), "copilot-shutdown"));

    int code = 0;
    try {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      AssistantMessageEvent response = session.sendAndWait(
          new MessageOptions().setPrompt(
              "Name three failure modes that show up only in long-running CLI subprocesses."
          )
      ).get();

      System.out.println(response.getData().content());
    } catch (Exception err) {
      System.err.println("session failed: " + err);
      code = 1;
    } finally {
      shutdown(client, stopped);
    }
    System.exit(code);
  }

  private static void shutdown(CopilotClient client, AtomicBoolean stopped) {
    if (!stopped.compareAndSet(false, true)) {
      return;
    }
    try {
      client.stop().get();
    } catch (Exception err) {
      System.err.println("client.stop() failed: " + err);
    }
  }
}
