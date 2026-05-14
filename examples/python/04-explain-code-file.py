# 04 — Explain a code file
#
# Read a file from disk and ask Copilot for a plain-English explanation.
#
# Run: python 04-explain-code-file.py <path-to-source-file>
# e.g.  python 04-explain-code-file.py 01-hello-world.py

import asyncio
import sys
from pathlib import Path

from copilot import CopilotClient
from copilot.generated.session_events import AssistantMessageData
from copilot.session import PermissionHandler


async def main() -> None:
    if len(sys.argv) < 2 or not sys.argv[1]:
        print("usage: python 04-explain-code-file.py <file>", file=sys.stderr)
        sys.exit(1)

    target = Path(sys.argv[1])
    source = target.read_text(encoding="utf-8")

    prompt = "\n".join([
        "Explain what this file does in 4-6 bullet points.",
        "Call out anything subtle (race conditions, hidden side effects, error swallowing).",
        "",
        f"--- {target} ---",
        source,
    ])

    client = CopilotClient()
    await client.start()
    try:
        session = await client.create_session(
            model="gpt-4.1",
            on_permission_request=PermissionHandler.approve_all,
        )
        reply = await session.send_and_wait(prompt)
        if reply and isinstance(reply.data, AssistantMessageData):
            print(reply.data.content)
    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
