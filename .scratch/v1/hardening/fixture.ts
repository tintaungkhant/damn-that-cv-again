import type { openStore } from "../../../lib/storage/store.ts";

// Every person, employer, achievement and conversation below is fictional trial data.
export const blocks = [
  ["p-contact", "## Contact\n\nAlex Morgan (fictional demo candidate). Backend/product engineer in Bangkok, Thailand. Email alex.morgan@example.com; portfolio https://example.com/alex; code https://example.com/alex/code. No phone number supplied. Open to remote work in Asia-Pacific; no work authorization outside Thailand confirmed."],
  ["p-summary", "## Career direction\n\nEight years of professional software work, 2018–2026. Prefers hands-on backend or product engineering with reliable services, clear ownership and useful interfaces. Interested in staff-track growth but has never held a staff title or managed direct reports. Has collaborated with support and operations rather than claiming their work as personal implementation."],
  ["p-current-role", "## Riverlight Logistics — Senior Software Engineer, January 2023–present\n\nFictional Bangkok employer. Team of six engineers; Alex is an individual contributor. Designs and implements TypeScript/Node.js services backed by PostgreSQL and Redis. Reviews code, joins the shared on-call rotation and writes incident follow-ups. Mentors two junior engineers through pairing, without people-management responsibility. Product serves regional logistics teams, but customer count, revenue and overall business growth are not confirmed. Uses Docker and GitHub Actions; platform engineers own production infrastructure."],
  ["p-previous-role", "## Northstar Tools — Software Engineer, July 2020–December 2022\n\nFictional remote employer. Built React/TypeScript admin workflows and Node.js REST endpoints for operations staff. Worked with a designer and a product manager. Contributed accessibility fixes and query tuning. Collaborated in a five-person engineering team; did not lead the organization or own every release."],
  ["p-first-role", "## Civic Data Lab — Junior Developer, June 2018–June 2020\n\nFictional Bangkok nonprofit. Maintained Python import scripts, validated CSV datasets and added small Django features. Wrote setup documentation for volunteer contributors. No formal data-science role or machine-learning production experience."],
  ["p-dispatch", "## Project: Dispatch queue recovery, Riverlight, 2024\n\nAlex implemented idempotency keys, bounded retries with jitter, and a dead-letter review workflow in a TypeScript job service. Paired with another engineer on the Redis queue design. Operations reported duplicate dispatch incidents falling from 18 to 3 per month in the three months after rollout. These are team-observed incident counts, not a claim about revenue or delivery speed. Alex wrote rollout checks and a recovery runbook. Do not claim a 99.99% SLA or zero incidents."],
  ["p-import", "## Project: Shipment CSV import, Riverlight, 2023\n\nAlex designed a streaming CSV parser, row-level validation and PostgreSQL batching. A repeatable staging benchmark for a 100,000-row file fell from 14 minutes to 4 minutes. This is a staging benchmark, not end-user production latency. Added a downloadable rejected-row report and coordinated input formats with support. Did not build a general ETL platform."],
  ["p-observability", "## Project: Service observability, Riverlight, 2025\n\nAdded OpenTelemetry spans and structured logging to three Node.js services. Alex instrumented request and queue paths, documented useful dashboards and helped correlate retries with upstream timeouts. The platform team provisioned Grafana and alert routing. No measured reduction in mean time to recovery was recorded. Do not invent one."],
  ["p-accessibility", "## Project: Accessible operations console, Northstar, 2022\n\nImplemented keyboard navigation, visible focus, input labels and clearer validation in React forms. Partnered with a designer on error states and tested core workflows with keyboard-only navigation. Ten internal operations users took part in a usability session. No WCAG certification, full compliance audit or conversion lift was claimed."],
  ["p-reporting", "## Project: Reporting queries, Northstar, 2021\n\nAlex analyzed query plans and added a composite PostgreSQL index for a frequently used reporting screen. On a fixed anonymized test dataset, p95 query latency fell from 2.4 seconds to 0.7 seconds. Product rollout was shared with the team. This was a specific query improvement, not an all-application performance claim."],
  ["p-onboarding", "## Project: Developer onboarding, Riverlight, 2025\n\nRewrote local setup instructions and added reproducible seed data for development. Paired with two recent hires to find missing steps. No measured onboarding-time reduction is available. Documentation and mentoring are useful supporting evidence, not proof of engineering management."],
  ["p-garden", "## Personal project: Community garden scheduler, 2020–2021\n\nBuilt a small Django/SQLite volunteer calendar as an unpaid personal project. Volunteers could reserve watering slots and see a weekly schedule. Deployment was a single low-cost virtual machine. Not a commercial SaaS, no paying users and no scale or revenue metrics."],
  ["p-visual", "## Personal project: Generative poster sketches, 2022\n\nExplored Canvas and small browser animations for a personal art series. Useful evidence of curiosity and UI experimentation, but unrelated to production backend infrastructure. No professional animation or design title."],
  ["p-skills", "## Skills and limits\n\nProfessional: TypeScript, JavaScript, Node.js, PostgreSQL, Redis, REST APIs, React, Git, Docker, GitHub Actions, code review and incident follow-up. Earlier professional use: Python and Django. Recent service instrumentation: OpenTelemetry. Personal use: SQLite and browser Canvas. No confirmed Kubernetes, Terraform, Rust, AWS certification or machine-learning deployment experience. Do not convert a job requirement into a candidate skill."],
  ["p-education", "## Education\n\nBSc in Computer Science, Eastbridge University (fictional), Bangkok, 2014–2018. No grade, class rank, scholarship or professional certification supplied."],
  ["p-languages", "## Languages and interests\n\nThai native speaker; English used for engineering documentation and remote teamwork, with no standardized test score. Enjoys community gardening and technical writing. These optional details can be omitted when they weaken focus or consume space."],
] as const;

export const backendJob = `Fictional job: Senior Backend Engineer at Harbor Parcel, remote Asia-Pacific.
Build TypeScript and Node.js APIs for shipment workflows. Use PostgreSQL and Redis, improve reliable background jobs and idempotent integrations, diagnose incidents, and work with support. Explain tradeoffs and mentor peers as an individual contributor. OpenTelemetry and Docker are useful. Kubernetes and Terraform are nice-to-have, not required. We value precise ownership and measured outcomes. We do not require a phone number, certifications or people-management experience.`;

export const productJob = `Fictional job: Product Engineer at Meadow Desk, remote Thailand.
Build accessible React and TypeScript operations tools backed by Node.js APIs and PostgreSQL. Work with designers, improve validation and debugging, and explain user-facing decisions. Python/Django is a useful secondary skill. Prefer two relevant projects over a long inventory. No design certification, management title or invented product-growth metrics required.`;

const topics = [
  ["Keep this a fictional trial, not my real career.", "All names, employers, dates and results in this workspace are fictional. Nothing here describes the account owner."],
  ["How should we position backend versus product experience?", "Lead with the logistics services for a backend role. Keep the React operations experience as supporting breadth; use it first for a product role."],
  ["Do I need a staff-engineer title to apply?", "No. The confirmed title is senior software engineer. Emphasize hands-on ownership and mentoring without claiming staff scope or management."],
  ["Explain the dispatch metric carefully.", "The confirmed observation is 18 duplicate incidents per month before rollout and 3 afterward over a three-month period. Attribute it to team observations. Do not infer revenue or an SLA."],
  ["Can the CSV benchmark be described as production speed?", "No. The 100,000-row import took 14 minutes before and 4 afterward in a repeatable staging benchmark. Keep that qualification attached to the numbers."],
  ["Which three projects fit queue reliability best?", "Dispatch queue recovery is strongest. Shipment import demonstrates validation and throughput. Observability supports debugging. The personal art sketches add little to that application."],
  ["Does pairing on Redis mean I designed the entire platform?", "No. Alex paired on the queue design and implemented specific application behavior. Platform engineers owned infrastructure. Separate individual contribution from shared decisions."],
  ["Can I list Kubernetes because the job asks for it?", "No confirmed Kubernetes experience exists. It is a nice-to-have in the pasted job, so omit it and concentrate on the proven Node.js, PostgreSQL and Redis work."],
  ["What about Terraform or AWS certification?", "Neither is confirmed. Docker use does not imply infrastructure ownership, and no certification should appear without a confirmed source."],
  ["Is the garden scheduler professional experience?", "It was unpaid personal work using Django and SQLite on one virtual machine. Label it personal if selected. Do not present it as a commercial SaaS."],
  ["Should we list all eight projects?", "No. Select up to the saved project limit. The backend opportunity benefits from three closely related examples rather than a complete project inventory."],
  ["How do accessibility fixes support a product role?", "Keyboard navigation, labels, visible focus and validation are concrete contributions. Ten operations users joined a usability session, but no compliance certification or growth lift was measured."],
  ["Can we call the reporting improvement a whole-app result?", "No. The fixed-dataset benchmark measures one reporting query: p95 went from 2.4 seconds to 0.7 seconds. Keep the query and test conditions explicit."],
  ["How should we show mentoring?", "Say that Alex paired with two junior engineers and reviewed code. Do not imply direct reports, hiring authority or engineering-manager responsibility."],
  ["Do missing outcomes block an observability bullet?", "No. Instrumenting three services and documenting useful dashboards is confirmed work. Omit an unmeasured recovery-time reduction rather than making one up."],
  ["What optional contact fields can be absent?", "A phone number is not supplied and can be omitted. Use only the confirmed fictional email, location and example.com links. Do not create a phone or social handle."],
  ["Should education always be first?", "Not for this experienced backend application. Experience and selected contributions should lead. Education is optional and can remain concise if included."],
  ["Can English be called certified fluent?", "No language test score or certification is confirmed. English is used in engineering documentation and remote teamwork; keep that modest description if relevant."],
  ["What should the summary avoid?", "Avoid generic visionary-leader language, invented scale, and a list of every technology. Describe hands-on backend work, reliability and operational collaboration."],
  ["Can we prefer custom section titles?", "Yes. Selected reliability work or Engineering contributions can fit better than a fixed Projects template. The schema supports text, lists and detailed entries."],
  ["What belongs in selection notes rather than CV JSON?", "Explain why queue work was prioritized, why art and gardening were omitted, and what a product-focused alternative would emphasize. Keep those explanations outside the exported CV."],
  ["Will a new profile fact rewrite an accepted CV?", "No. Saved CV revisions keep their original profile snapshot. A refreshed draft requires a request, review and explicit acceptance."],
  ["Can a draft replace the accepted CV automatically?", "No. Successful generation saves a draft. Accept this CV changes the accepted revision. Discarding another draft must preserve the accepted one."],
  ["Recap constraints before drafting.", "Use confirmed facts only, select three relevant projects for Harbor Parcel, qualify benchmark numbers, omit unconfirmed infrastructure skills, and explain alternatives in the reply. This discussion fixture does not approve new facts."],
] as const;

export function seedCareer(store: ReturnType<typeof openStore>) {
  const chat = store.createChat({ category: "profile", title: "DEMO · Career profile and approvals" });
  const turn = store.beginTurn({ chatId: chat.id, content: "FICTIONAL TRIAL DATA\n\n" + blocks.map(([, content]) => content).join("\n\n") });
  store.completeTurn(turn.id, "Fictional career organized into stable blocks. This initial batch was explicitly approved by the trial setup, not by the model.", {
    baseRevision: null, summary: "Complete fictional career for manual exploration",
    operations: blocks.map(([id, content], index) => ({ type: "insert" as const, id, afterId: index ? blocks[index - 1][0] : null, content })),
  });
  store.approveProfileProposal(store.getProfileProposals(chat.id)[0].id, null);
  return chat;
}

export function seedDiscussion(store: ReturnType<typeof openStore>, chatId: string) {
  for (const [question, answer] of topics) {
    const turn = store.beginTurn({ chatId, content: question });
    store.completeTurn(turn.id, "[Synthetic discussion fixture] " + answer);
  }
}
