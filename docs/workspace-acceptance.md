# Workspace acceptance checklist

Ticket 14 checks attachments, job tracking, chat navigation, and the hideable workspace together. Agents do not run browser or visual checks (`.ai/rules/testing.md`). You run this checklist and record the result below. Automated evidence is in `.scratch/workspace-next/acceptance/findings.md`.

## Setup

Run both passes in this order:

- **Wide pass:** browser window at least 1024px wide.
- **Narrow pass:** window below 1024px, for example 390px in device emulation.

Use one of these workspaces:

- **Synthetic workspace (recommended for navigation):** run `bun run build`, then `node .scratch/workspace-next/acceptance/workspace.ts`. Open http://localhost:3801. It has 50 CV chats, 70 profile chats, and 30 jobs in a temporary database. Replies use your local Claude login. Press Ctrl+C in that terminal to stop it; this deletes the temporary data. Your `data/app.sqlite` is not opened.
- **Your own workspace:** run `bun run dev` and open http://localhost:3800. Your existing chats and documents must still open and work after the upgrade.

Test files are in `lib/ai/fixtures/`. All of them are fictional.

## 1. Attachments

Do this in a profile chat and again in a CV chat.

1. Choose **Attach files**. Send `text.pdf`, `scan.pdf`, `career.docx`, `notes.txt`, and `notes.md` together with a short question. Before sending, remove one file and add it again.
2. Send `image.png`, `image.jpg`, and `image.webp` with no message text.
3. Check the DOCX text-only notice before sending. Check that the reply uses content from each file, including the scanned PDF and the images.
4. Each saved file shows its name, type, size, and a download control. Download every file and compare it with the original. Check the downloaded filenames.
5. Stop a reply that has files. Use **Retry saved message**. The message and its files appear once.
6. Restart the app and reopen the chat. Ask about an earlier file. The files are still there, and the reply still uses them.
7. Try `image-only.docx`, `encrypted.pdf`, `invalid.txt`, `animated.webp`, and six files at once. Each one gives a clear error. No message is saved, and your text and selected files stay in the composer.
8. In a CV chat with files, profile changes still need **Approve whole batch**, and CV drafts still need acceptance. Files never approve anything.
9. Delete a disposable chat that has files. Files in other chats still download.

Narrow pass: repeat steps 1, 4, and 7. Check that long filenames wrap and that the attach, remove, and download controls can be reached by keyboard.

## 2. Jobs

1. Open **Jobs**. Use **New job** with a title and an HTTP(S) URL. The status is **Applied** by default. Open the job's direct link in a new tab.
2. Use **Edit** to change the title, URL, and a description with several lines. The timeline shows one event with the old and new values. Save without changes: no new event appears.
3. Post a comment alone. Change the status alone. Then change the status and add a comment in one submission. Each submission adds exactly one event, in time order.
4. Post `<b>hello</b>` as a comment. It shows as literal text. Events have no edit or delete controls.
5. Open the same job in two tabs and save a change in the first. Save from the second tab: it rejects with a refresh instruction and keeps your input.
6. On the list, search by title, by URL fragment, and by description text. Filter by each status. With the synthetic workspace, page 2 exists and next/previous keep the search and filter.
7. Open a CV chat's **Job** tab. Its settings did not change because of tracker jobs.

Narrow pass: repeat steps 1, 3, and 6. Check that the table, dialogs, and timeline are readable and usable.

## 3. Navigation with 120 chats

Use the synthetic workspace.

1. Each sidebar category shows at most five chats, newest activity first, then **View all**.
2. Open **CV chats** and **Profile chats**. Each category page has 25 chats per page. Check every page: no chat repeats and none is missing (50 CV chats and 70 profile chats).
3. Search `oldest` on each category page. The oldest chat is found and opens. Its tab title and breadcrumb show its name, and the breadcrumb returns to its category.
4. Send a message in an older chat. It moves to the top of its sidebar category.
5. Create a chat from a category page, then delete one there. You return to the same page. A CV chat deletion still warns about CV revisions.
6. Collapse the sidebar. Home, Career profile, CV chats, Profile chats, and Jobs stay reachable as icons with tooltips.

Narrow pass: open the sidebar sheet and check steps 1, 3, and 6.

## 4. Workspace panel

Wide pass:

1. In a chat, select a workspace tab and drag the panel wider. Use **Hide workspace**. The conversation takes the full width. Use **Show workspace**. The same tab and width return.
2. Type values in a CV chat's **Job** tab without saving. Hide and show the workspace. The values are still there.
3. Hide the workspace, reload, and open another chat. It is still hidden. Show it, and the last width returns.
4. With the workspace hidden, use an in-thread **Review** action. The workspace opens on that tab. Nothing is approved.

Narrow pass:

5. With the desktop workspace hidden, narrow the window below 1024px. The **Workspace** button still opens the workspace sheet.

## Manual acceptance record

The agent never fills in this table. Mark each row **Pass** or **Fail** with a note, or send a description or screenshot so it can be recorded.

| Area | Wide pass | Narrow pass | Notes |
| --- | --- | --- | --- |
| 1. Attachments | Pending | Pending | |
| 2. Jobs | Pending | Pending | |
| 3. Navigation with 120 chats | Pending | Pending | |
| 4. Workspace panel | Pending | Pending | |
| Existing chats and documents in your own workspace | Pending | — | |

Detailed checks for each feature: `docs/attachment-checks.md`, `docs/job-tracker-checks.md`, and `docs/navigation-checks.md`.
