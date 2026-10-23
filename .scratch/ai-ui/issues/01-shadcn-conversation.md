# Use official shadcn AI conversation patterns

Status: ready-for-human
Type: task

## Scope

Enhance the existing profile and CV conversation UI with official shadcn AI Elements compositions. Keep the existing provider and Server Action transport, persistence, cancellation, retry, and approval flows.

## Acceptance

- [x] Inspect official shadcn component, block, and AI Elements catalogs.
- [x] Install covered primitives through the shadcn CLI.
- [x] Compose Message Scroller, Input Group prompt input, Empty onboarding, starter Button prompts, Spinner, Alert, and Collapsible usage.
- [x] Render assistant Markdown safely and reuse rendering for profile documents.
- [x] Preserve saved-message retry and explicit document approval.
- [x] Pass typecheck, lint, and behavior tests.- [x] Pass production build.
- [ ] User visual acceptance on desktop and narrow screens, including streaming scroll, keyboard/IME input, stop, and retry.

## Comments

2026-10-23: Implemented in `components/chats/conversation.tsx`, shared Markdown in `components/chats/markdown.tsx`, and CLI-installed `components/ui/` primitives. Official patterns: https://ui.shadcn.com/docs/ai-elements/radix/chat and https://ui.shadcn.com/docs/ai-elements/radix/prompt-input. Existing Message/Bubble were already appropriate. No reasoning or source events are invented; token counts are usage rather than a context-window estimate. Manual checks documented in README.md. Typecheck, lint, and all 53 behavior tests pass. Visual acceptance remains user-run per project rules.
