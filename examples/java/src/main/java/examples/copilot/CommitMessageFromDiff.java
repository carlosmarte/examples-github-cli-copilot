// 05 — Generate a commit message from staged changes
//
// Runs `git diff --cached` and asks Copilot for a Conventional-Commits-style
// message. Stage some changes first (`git add -p`) before running.
//
// Run: COPILOT_DISABLE_MCP=1 mvn -q exec:java -Dexec.mainClass=examples.copilot.CommitMessageFromDiff
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

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public final class CommitMessageFromDiff {
  public static void main(String[] args) throws Exception {
    System.setProperty("copilot.disable.mcp", "1");
    String diff = runGitDiffCached();
    if (diff.isBlank()) {
      System.err.println("No staged changes. Run `git add` first.");
      System.exit(1);
    }

    String prompt = String.join("\n",
        "Write a Conventional Commits message for the following staged diff.",
        "Format: <type>(<scope>): <subject> on the first line, blank line, then a short body.",
        "Keep the subject under 72 characters. Focus on the *why*, not the *what*.",
        "",
        "--- diff ---",
        diff
    );

    try (CopilotClient client = new CopilotClient()) {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      AssistantMessageEvent response = session.sendAndWait(
          new MessageOptions().setPrompt(prompt)
      ).get();

      System.out.println(response.getData().content());
    }
  }

  private static String runGitDiffCached() throws IOException, InterruptedException {
    Process p = new ProcessBuilder("git", "diff", "--cached")
        .redirectErrorStream(false)
        .start();
    byte[] out = p.getInputStream().readAllBytes();
    int rc = p.waitFor();
    if (rc != 0) {
      throw new IOException("git diff --cached exited " + rc);
    }
    return new String(out, StandardCharsets.UTF_8);
  }
}
