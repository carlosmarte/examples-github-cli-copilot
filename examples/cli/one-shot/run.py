#!/usr/bin/env python3
"""One-shot — Python driver for the `copilot` CLI.

Shells out to `copilot -p "<prompt>" --allow-all-tools`, inherits stdio so the
result streams straight to the parent terminal, and propagates the exit code.
Python counterpart of examples/nodejs/simple-sdk/01-hello-world.mjs driving
the CLI subprocess instead of the in-process SDK.

Pattern reference: CLI.md §1.

Run:
    python3 run.py
    python3 run.py "Summarize the last 5 git commits as a markdown list"
"""

from __future__ import annotations

import shutil
import subprocess
import sys


def main() -> int:
    if shutil.which("copilot") is None:
        print("`copilot` CLI not found on PATH", file=sys.stderr)
        return 127

    prompt = sys.argv[1] if len(sys.argv) > 1 else "What is 2 + 2? Reply with only the digit."
    return subprocess.run(["copilot", "-p", prompt, "--allow-all-tools"]).returncode


if __name__ == "__main__":
    sys.exit(main())
