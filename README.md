# @deepseek-ai/dsh-mobile

Mobile-first overlay for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web UI (`dsh web`).

The built-in web surface is a three-column desktop shell: a sidebar rail, a
conversation center column, and a details track. On a phone the rail and the
empty details track still consume width, squeezing the chat into a narrow
slit. This plugin turns the same composition into a mobile surface without
forking any of the built-in UI.

## What it does

At viewports **< 1024px** (matching the layout plugin's own "narrow"
breakpoint):

- **Full-bleed chat** — the sidebar rail and details track collapse to 0, so
  the conversation gets the whole viewport.
- **Sidebar as a drawer** — the rail is hidden; a hamburger in the
  conversation header (and a floating button on the blank/hero screen) opens
  the sidebar as an overlay drawer with a backdrop. Esc, the backdrop, the
  sidebar's own fold toggle, and switching sessions all close it.
- **Details panel as a sheet** — opening a tool's details covers the chat as
  a full-screen sheet instead of rendering off-screen.
- **Touch polish** — safe-area insets for notched phones, overscroll
  containment, `touch-action: manipulation` (no double-tap zoom delay), no
  tap-highlight flash, and a bottom-safe-area composer.

Desktop (≥ 1024px) is untouched: the plugin contributes nothing there.

## How it works

A **bundle plugin** — the same pattern as `@deepseek-ai/dsh-escalation-tolerance`:

- `cordis.patch.yml` inserts one loader entry (`dsh-mobile`) into the web
  composition after `@deepseek-ai/dsh-web-app`.
- `package.json` declares `dsh.client` (`platform: "web"`), so
  `@deepseek-ai/dsh-client-modules` serves `lib/client.js` as a browser
  bundle and the web shell boots it as a client-side cordis entry.
- `lib/client.js` injects a stylesheet (CSS overrides keyed off the frame's
  `data-shell-overlay` marker, so it survives the hashed class names) and
  registers three slot contributions:
  - `conversation.session.header.actions` — the hamburger,
  - `shell.overlay` — the drawer/details backdrop + the hero floating menu,
  - plus a document-level Esc handler and a session-switch listener.
- Drawer state is read from the **same layout store instance** the AppFrame
  writes (`ctx.slots.hostFace().storeOf(rootEntry, "root")`), so the drawer
  always mirrors the shell's own `narrowExpanded` / `details` state; opening
  and closing goes through `ctx.layout.toggleSidebar()` /
  `ctx.layout.closeDetails()`.

## Installing

The plugin lives at `$DSH_HOME/plugins/dsh-mobile` and is wired into the
`web` profile:

```bash
# from the web profile directory
cd "$DSH_HOME/profiles/web"
pnpm install    # links @deepseek-ai/dsh-mobile (already in package.json)
```

If you prefer a separate surface, add `"@deepseek-ai/dsh-mobile"` to the
`dsh.profile.bundles` list of any other profile (for example a new
`mobile` profile) — the bundle's patch layer applies the same way.

## Notes

- Everything is viewport-scoped (`@media (max-width: 1023px)`); desktop
  behavior is untouched.
- The CSS overrides are keyed to the frame's `[data-shell-overlay]` child
  (an attribute the built-in layout plugin renders) so they survive the
  hashed CSS module class names of the built-in UI. If the layout plugin
  changes that marker, the selectors need a refresh.
- Client bundle changes require a page reload (the graph re-hash is picked
  up on the next boot; `pnpm run dev:web` in the dsh checkout provides HMR
  for the in-box client packages).
