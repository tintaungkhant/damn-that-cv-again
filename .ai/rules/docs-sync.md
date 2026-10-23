Applies to: every change in this repo, including code, rules, and decisions.

# Docs sync rules

- When a change affects what another file says, update that file in the same change. This covers the spec (`docs/product-spec.md`), tickets (`.scratch/**/issues/`), ADRs (`docs/adr/`), `GLOSSARY.md`, `AGENTS.md`, `README.md`, and rule files.
- Before you finish, search those files for anything your change makes wrong, out of date, or contradicted. Fix it or record the conflict in the affected ticket.
- When a ticket's plan conflicts with a new rule or decision, rewrite the ticket's scope. Do not leave the old plan in place.
- When a ticket is done, tick its acceptance boxes and add a short comment that points to the work.
