---
description: Capture the active Chrome tab and answer a question about it
argument-hint: [question]
allowed-tools: [Bash(ctab:*), Read]
---

Capture the user's currently active Chrome tab and use it as visual context.

1. Run `ctab screenshot` via Bash. The CLI prints an absolute PNG path to stdout, single line.
2. Read the PNG at that path.
3. If the user's question follows, answer it using the screenshot as visual context. Otherwise, briefly describe what's on screen.

User's question (may be empty): $ARGUMENTS
