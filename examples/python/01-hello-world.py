# 01 — Hello world
#
# The smallest useful Copilot SDK program: open a client, create a session,
# send one prompt, print the answer, shut the client down.
#
# Run: python 01-hello-world.py

import asyncio
import os

from copilot import CopilotClient
from copilot.generated.session_events import AssistantMessageData
from copilot.session import PermissionHandler

# Disable any user-configured MCP servers so this example runs against the
# bare SDK surface only.
os.environ["COPILOT_DISABLE_MCP"] = "1"


async def main() -> None:
    client = CopilotClient()
    await client.start()
    try:
        session = await client.create_session(
            model="gpt-4.1",
            on_permission_request=PermissionHandler.approve_all,
        )
        reply = await session.send_and_wait("What is 2 + 2?")
        if reply and isinstance(reply.data, AssistantMessageData):
            print(reply.data.content)
    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
