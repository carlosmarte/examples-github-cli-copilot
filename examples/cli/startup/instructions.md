# Output guardrails

You must reply with a single valid JSON object — keys: `method`,
`idempotent`, `safe`, `summary`.

- `method` (string): the HTTP method name in upper-case
- `idempotent` (boolean): whether repeated identical calls yield the same
  server state
- `safe` (boolean): whether the method is defined as safe in RFC 9110
- `summary` (string): one sentence describing what the method does

No prose outside the JSON. No markdown fences. No preamble.
