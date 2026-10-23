Applies to: all code in this repo.

# Engineering rules

## Packages before handwritten code

- Before writing any non-trivial logic, search for a standard, popular, well-maintained package that already does it. Write it by hand only when none fits.
- Judge a package by recent releases, open-issue activity, download count, and TypeScript support. Prefer the one the ecosystem already uses.
- When you hand-roll something a package could do, say why in one line.

## DRY and YAGNI

- Don't repeat logic. Extract shared code once a second real use exists, not before.
- Build only what the current ticket needs. No speculative options, abstractions, config, or extension points.

## Lazy senior engineer

- Write the least code that solves the problem correctly. Lazy means less code, not less care.
- Handle real failure cases, validate at boundaries, and keep types honest.
- No overengineering to show off: no extra layers, patterns, or generics without a present need.
- Prefer boring, obvious code over clever code.
