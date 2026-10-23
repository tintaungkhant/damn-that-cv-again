# Navigation and workspace checks

Ticket 13 bounds chat navigation and adds desktop **Hide workspace** / **Show workspace** controls. Primary navigation is Home, Career profile, CV chats, Profile chats, and Jobs. The sidebar shows the five most recently active chats per category with **View all** links. `/chats?category=build` and `/chats?category=profile` list every chat with title search, create, open, delete, and 25-row pages.

## Automated evidence

`lib/storage/store.test.ts` uses real SQLite through the public store interface. It creates 50 build and 70 profile chats with near-identical timestamps. It checks stable 25-row pages without duplicates, case-insensitive title search that finds older chats, category isolation, five-row sidebar queries, activity reordering after a new message, deletion counts, and input bounds. A v5 database migrates to v6 and backfills activity time from the latest message, or the creation time when a chat has none.

`lib/workspace-preference.test.ts` checks the saved panel preference. Absent, malformed, or mistyped values fall back to an open workspace at 45%. Restored widths clamp to 30–65% so the conversation keeps at least 35%.

## User-run checks

No agent browser or visual checks are allowed by `.ai/rules/testing.md`. Run `bun run dev` and open `http://localhost:3800`. Older-chat checks need more than 25 chats in one category.

1. Collapse the sidebar to icons. Home, Career profile, CV chats, Profile chats, and Jobs stay reachable with tooltips. The current page's link is highlighted, including the matching chat category.
2. Expanded sidebar: each category shows at most five chats, newest activity first, then **View all (N)**. Send a message in an older chat; it moves to the top of its category.
3. Open **CV chats** and **Profile chats**. Search for a title fragment of an old chat on a later page and open it. Its browser tab title and breadcrumb show the chat title; the breadcrumb links back to its category. Next/previous keep the search.
4. Create a chat from a category page; it opens the new chat. Delete a chat from a category page; you return to that page. Delete the open chat from the sidebar; you return Home. Build chat deletion still warns about CV revisions.
5. On a wide screen (1024px or more), select a workspace tab and drag the panel wider. Use **Hide workspace**; the conversation takes the full width and the workspace is skipped by Tab. Use **Show workspace**; the same tab and width return.
6. Type unsaved values in the build chat **Job** tab. Hide and show the workspace; the values remain.
7. Hide the workspace, then reload and navigate to another chat. It stays hidden. Show it; the last width returns. Drag it below its minimum to collapse it; **Show workspace** reappears.
8. With the workspace hidden, use an in-thread **Review draft** or **Review changes** action. The workspace reopens on that tab. Nothing is approved automatically. A reply that proposes changes while hidden shows a **Review** toast.
9. Narrow the window below 1024px. The **Workspace** sheet button still opens the workspace, even if the desktop preference is hidden.
10. In browser dev tools, set the `cv-workspace-panel` local storage value to `{"open":true,"size":99}` and reload. The workspace opens at its maximum width; the conversation keeps its minimum. Set it to `garbage` and reload; the default layout appears.

## Review

Review baseline: `3cf4bfd`. Standards and spec review ran inline, as required by `.ai/rules/agent-workflow.md`. Fixed: chat pages now set the browser tab title to the chat title, and Jobs and chat lists share one pagination component. Visual acceptance remains user-run.
