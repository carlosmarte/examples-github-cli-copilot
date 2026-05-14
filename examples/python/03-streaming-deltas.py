# 03 — Streaming deltas
#
# Subscribe to session events so each AssistantMessageData chunk prints as it
# arrives. Events fire automatically during `send_and_wait()`, so no separate
# idle-await is needed in the common case.
#
# Run: python 03-streaming-deltas.py

import asyncio
import sys

from copilot import CopilotClient
from copilot.generated.session_events import AssistantMessageData
from copilot.session import PermissionHandler


async def main() -> None:
    client = CopilotClient()
    await client.start()
    try:
        session = await client.create_session(
            model="gpt-4.1",
            streaming=True,
            on_permission_request=PermissionHandler.approve_all,
        )

        def on_event(event) -> None:
            if isinstance(event.data, AssistantMessageData):
                sys.stdout.write(event.data.content or "")
                sys.stdout.flush()

        unsubscribe = session.on(on_event)
        try:
            await session.send_and_wait(
                "Write a haiku about Python's Global Interpreter Lock."
            )
        finally:
            unsubscribe()
        sys.stdout.write("\n")
    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
