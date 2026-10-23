# AI conversation UI

Use the official shadcn AI Elements compositions in profile and build chats. Install new primitives through the shadcn CLI. Keep the existing Server Action streaming transport and all persistence, retry, cancellation, and explicit document approval behavior.

Deliver a bounded, scrollable conversation with return-to-latest control, readable assistant Markdown, a prompt composer with keyboard support, editable starter suggestions, pending feedback, actionable errors, and expandable token usage. Reuse existing Message/Bubble primitives. Do not add unsupported uploads, provider choices, fabricated reasoning, sources, or tool traces.

Verification: typecheck, lint, existing behavior tests, and production build. User performs visual acceptance per `.ai/rules/testing.md`; see `issues/01-shadcn-conversation.md` and README.md.
