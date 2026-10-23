# Explore the fictional trial workspace

On 2026-10-23 the user reset `data/app.sqlite` to start from an empty workspace, so this trial workspace is no longer installed. The guide is kept as a record of the Ticket 09 trial. Its trial databases remain in the ignored `data/trial-workspaces/` folder.

Open http://localhost:3800. All career data belongs to fictional **Alex Morgan**, not the app owner. The previous test database was archived locally before replacement.

## Suggested route

1. **DEMO · Backend application · sonnet trial**: review the accepted three-project CV, its custom section, internal Raw JSON and separate selection notes. Try Copy JSON and Download JSON. The workspace **Draft** tab contains a live shorter two-project version with education omitted. History contains the original accepted version and a discarded restored copy. Accept or discard the shorter draft, or restore history as a new draft. Exports must continue using the accepted revision until you accept another.
2. **DEMO · Product engineer · accepted CV**: compare the different job description, two-project limit, accessibility/reporting emphasis and accepted CV. Its discussion and job details are independent of the backend application.
3. **DEMO · New facts · review before approval**: inspect the live profile proposal for a vendor integration. Compare Before and After approval. The new project and open questions must not enter the confirmed profile until you approve. Ask for a revision if desired, or approve and inspect profile history.
4. **DEMO · Career profile and approvals**: inspect the complete career profile and three saved revisions. The setup approved an added onboarding detail, then restored the original as a new revision. An older CV may show the profile-change notice even though undo restored identical content; its snapshot ID still refers to its original revision.
5. **DEMO · Retry a saved message**: click Retry saved message. The trial deliberately marked this message failed; there is no provider outage. A successful retry must add one assistant reply without duplicating the user message.
6. **DEMO · Try a fresh CV · no projects**: saved backend job details have project limit zero. Prepare a draft request, then send. The generated draft should omit projects, remain unaccepted, and include selection notes.

## What to look for

- Reopen chats and reload: messages, job settings, accepted CVs and history remain available.
- Replies appear incrementally. Try Stop reply and retry; partial text must not become a saved CV or profile proposal.
- Contacts have no invented phone number. The backend CV omits Kubernetes/Terraform and qualifications that are not confirmed.
- Dispatch incidents are team-observed counts (18 to 3 per month). CSV timing is a staging benchmark (14 to 4 minutes), not production latency. The product query result (2.4 to 0.7 seconds) is scoped to one query on a test dataset.
- A confirmed profile change must not silently rewrite an accepted CV. Ask for a refreshed draft, then review and accept separately.
- Exported JSON contains CV content without evidence or selection notes. Internal Raw JSON intentionally includes evidence.
- Create a disposable chat to try deletion. Build chat deletion requires confirmation; deleting a profile chat must preserve approved shared facts.

The initial long backend discussion contains 48 clearly labeled synthetic fixture messages. CV generations, the shorter revision and pending integration proposal are live Claude output. Initial model is pinned to `claude-sonnet-5-5` after a paired Sonnet/Haiku trial; this case favored Sonnet for latency and output length. See `.scratch/v1/hardening/findings.md` for measurements and the acceptance audit.

Ticket 09's automated work is complete. Browser layout, clipboard/download interactions and your editorial assessment remain manual acceptance checks. Ticket 08 is retired; there is no in-app backup/restore feature. The original local database archive path is recorded in `data/trial-workspaces/install.json`, outside Git.
