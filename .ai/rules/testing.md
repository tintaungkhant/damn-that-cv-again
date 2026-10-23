Applies to: all tests and all verification of a change.

# Testing rules

- Tests cover behavior: functions, modules, Server Actions, storage, and the provider layer. Do not test visuals such as layout, styling, or rendered markup.
- Do not run browser tests, visual tests, screenshot tests, or browser automation. Do not open the app in a browser to check a change.
- When a change needs a visual check, flag it to the user. Say what to open and what to look for. The user will send a screenshot or describe what they see.
