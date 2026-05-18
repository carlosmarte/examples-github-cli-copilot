# 02 — Multi-turn conversation
#
# One session, multiple sequential prompts. The session keeps prior turns as
# context, so the second prompt can refer to the first answer.
#
# Run: python 02-multi-turn-conversation.py

import asyncio
import os

from copilot import CopilotClient
from copilot.generated.session_events import AssistantMessageData
from copilot.session import PermissionHandler

# Disable any user-configured MCP servers so this example runs against the
# bare SDK surface only.
os.environ["COPILOT_DISABLE_MCP"] = "1"


TURNS = [
    "Give me a one-line description of the Fibonacci sequence.",
    "Now write a Python function that returns the nth Fibonacci number.",
    "Add a memoized version below the first one.",
]


async def main() -> None:
    client = CopilotClient()
    await client.start()
    try:
        session = await client.create_session(
            model="gpt-4.1",
            on_permission_request=PermissionHandler.approve_all,
        )
        for prompt in TURNS:
            print(f"\n>>> {prompt}\n")
            reply = await session.send_and_wait(prompt)
            if reply and isinstance(reply.data, AssistantMessageData):
                print(reply.data.content)
    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
