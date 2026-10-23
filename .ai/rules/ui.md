Applies to: all UI code (pages, layouts, components, styling).

# UI rules

- Use shadcn/ui components and blocks for every UI element they cover. Check the shadcn component and block catalog before building anything.
- Add components with the shadcn CLI. Don't copy them by hand.
- Compose existing shadcn components before writing a custom one. Write a custom component only when nothing in shadcn fits, and keep it small.
- Style with Tailwind utilities and the shadcn theme tokens. No separate CSS unless Tailwind can't express it.
