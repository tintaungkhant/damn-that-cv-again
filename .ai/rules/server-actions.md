Applies to: all code where the browser talks to the server.

# Server actions rules

- Do not add API endpoints. That means no Route Handlers (`app/**/route.ts`) and no `pages/api/`.
- The browser does not call this app's server with `fetch`, `EventSource`, or `XMLHttpRequest`.
- Every write from the browser goes through a Server Action (`'use server'`).
- Read data in Server Components. When a Client Component needs data after an interaction, get it from a Server Action.
- Server Actions can be called with a direct POST, not only from the UI. Validate every input inside the action.
