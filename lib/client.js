/**
 * @deepseek-ai/dsh-mobile — browser half.
 *
 * Mobile-first overlay for the DeepSeek Harness web UI. Ships as a
 * `dsh.client` bundle: the web shell adopts this package as a client-side
 * cordis entry, and this factory registers the entry's React contributions.
 *
 * What it does (all scoped to viewports < 1024px, matching the layout
 * plugin's own "narrow" auto-collapse breakpoint):
 *
 *  1. Full-bleed chat. The three-column frame's sidebar rail (56px) and the
 *     empty details track collapse to 0, so the conversation gets the whole
 *     viewport instead of a 262px slit on a 390px phone.
 *  2. Sidebar as a drawer. The rail is hidden, so the header gains a menu
 *     button (blank/hero state gets a floating one) that calls the layout
 *     service's toggleSidebar — in narrow mode that flips the store's
 *     `narrowExpanded` override, and CSS floats the sidebar column over the
 *     center with a backdrop and elevation. Esc, the backdrop, the sidebar's
 *     own fold toggle, and switching sessions all close it.
 *  3. Details panel as a full-screen sheet. When a tool detail opens on
 *     narrow screens it overlays the chat instead of rendering off-screen in
 *     the collapsed details track; the existing Close button and the
 *     backdrop dismiss it.
 *  4. Settings as a full-screen sheet. The built-in settings modal is an
 *     800px two-column dialog (188px nav rail + content column); on a phone
 *     that squeezes the content column to ~150px. At the narrow breakpoint
 *     the shell is restacked into a full-bleed sheet: the nav rail becomes a
 *     horizontal section strip (with the panel title and per-section icons
 *     dropped) and the content column takes the full width below. The
 *     sheet's own overlay (z-index 1000) already covers the open drawer, so
 *     no drawer coordination is needed.
 *  5. Directory picker ("Select Workspace Directory") as a full-screen
 *     sheet. The built-in dialog is min(680px,100%) wide with a two-pane
 *     Miller column (each pane min-width 256px) — on a phone two panes
 *     overflow the viewport and the footer wraps to two rows. At the narrow
 *     breakpoint the dialog goes full-bleed, the panes become full-width
 *     scroll-snap pages (the component already auto-scrolls to the newly
 *     opened child pane; swipe back to the parent), and the footer becomes
 *     a single non-wrapping row that scrolls horizontally when tight. The
 *     create-folder subdialog stays a centered card.
 *  6. Touch polish: safe-area insets for notched phones, overscroll
 *     containment on the chat scroller, `touch-action: manipulation` on
 *     interactive elements, and no tap highlight flash.
 *
 * The layout store (ui-layout's root-entry store) is read through
 * `ctx.slots.hostFace().storeOf(rootEntry, "root")` — the same instance the
 * AppFrame writes — so the drawer state always mirrors the shell's own.
 */

window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-mobile",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");
    var jsxRuntime = require("react/jsx-runtime");
    var primitives = require("@deepseek-ai/dsh-client-ui-primitives");

    /** Stable plugin id (graph entry name == package name). */
    const PLUGIN_ID = "@deepseek-ai/dsh-mobile";
    /** data-plugin-css tag id for the injected stylesheet. */
    const CSS_TAG = PLUGIN_ID + "/mobile.css";

    // ── styles ─────────────────────────────────────────────────────────────
    // Scoped to `@media (max-width: 1023px)` (layout's SIDEBAR_AUTO_COLLAPSE
    // is 1024). The frame is selected structurally (`:has(> [data-shell-overlay])`)
    // so this survives the hashed class names of the built-in UI.
    const css = [
      "@media (max-width: 1023px) {",
      /* Frame: drop the sidebar rail and details track; center takes all.
       * The columns get explicit grid-column placement: once the open
       * sidebar becomes position:absolute (out of grid flow), the center
       * and details columns would otherwise auto-place into tracks 1/2 —
       * stealing the 0px sidebar track — so pin them to their own tracks. */
      "  div:has(> div[data-shell-overlay]) { grid-template-columns: 0 minmax(0, 1fr) 0 !important; transition: none !important; }",
      "  div:has(> div[data-shell-overlay]) > div:first-child { display: none; }",
      "  div:has(> div[data-shell-overlay]) > div:nth-child(2) { min-width: 0; grid-column: 2; }",
      "  div:has(> div[data-shell-overlay]) > div:nth-child(3) { grid-column: 3; }",
      /* Panel drag handles (children 5 and 6) are pointless on touch; hide
       * them. Child 4 is the shell overlay layer — it must stay visible
       * (the drawer/details backdrops render inside it). */
      "  div:has(> div[data-shell-overlay]) > div:nth-child(5), div:has(> div[data-shell-overlay]) > div:nth-child(6) { display: none; }",
      /* Sidebar open (narrowExpanded, mirrored to data-dsm-drawer): float
       * the column over the center as a drawer. */
      "  div:has(> div[data-shell-overlay])[data-dsm-drawer] > div:first-child {",
      "    display: flex; position: absolute; left: 0; top: 0; bottom: 0;",
      "    width: min(320px, 86vw); z-index: 30; box-shadow: var(--dsw-shadow-lv3);",
      "  }",
      "  div:has(> div[data-shell-overlay])[data-dsm-drawer] [data-slot='sidebar'] > div { width: 100% !important; }",
      /* Details open: full-screen sheet over the chat. The frame's own
       * `data-details-collapsed` is unreliable on mobile (computeColumns
       * concedes the details track to 0 on narrow viewports even while the
       * store says it is open), so the overlay component mirrors the store
       * to `data-dsm-details` on the frame. The sheet spans all grid tracks
       * (grid-column 1/-1): an abspos grid child's offsets resolve against
       * its grid AREA, so without the span it would stay anchored to the
       * 0px track 3 at the right edge. */
      "  div:has(> div[data-shell-overlay])[data-dsm-details] > div:nth-child(3) {",
      "    position: absolute; inset: 0; grid-column: 1 / -1; width: auto !important; z-index: 29;",
      "    border-left: none; background: var(--dsw-alias-bg-layer-3);",
      "  }",
      /* Conversation header: tighter horizontal padding + top safe-area.
       * Selector: the conversation root's direct header (the details panel
       * has its own header and must keep its padding). */
      "  [data-phase] > header { padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 0 12px !important; }",
      /* Settings shell: restack the 800px two-column modal into a full-screen
       * sheet — nav rail on top as a horizontal section strip, content
       * full-width below (see the structure note in the file header). The
       * dialog is identified by its direct <nav> child (the section rail);
       * every other Modal in the app (directory picker, confirmations, …)
       * has a different structure, so nothing else is affected. */
      "  div[role='presentation'] > div[role='dialog'] > nav {",
      "    flex-direction: row; gap: 2px; width: auto; flex: none;",
      "    padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 0 12px;",
      "  }",
      "  div[role='presentation'] > div[role='dialog'] > nav > .VOzbGW_navTitle { display: none; }",
      "  div[role='presentation'] > div[role='dialog'] > nav > .VOzbGW_navList {",
      "    flex-direction: row; gap: 4px; width: 100%; overflow-x: auto;",
      "    scrollbar-width: none; -webkit-overflow-scrolling: touch;",
      "  }",
      "  div[role='presentation'] > div[role='dialog'] > nav > .VOzbGW_navList::-webkit-scrollbar { display: none; }",
      "  div[role='presentation'] > div[role='dialog'] > nav .VOzbGW_navCell {",
      "    height: 34px; width: auto; flex: none; white-space: nowrap;",
      "    padding: 0 14px; font-size: 13px; line-height: 34px;",
      "  }",
      "  div[role='presentation'] > div[role='dialog'] > nav .VOzbGW_navIcon { display: none; }",
      "  div[role='presentation'] > div[role='dialog'] > nav .VOzbGW_navLabel { flex: none; }",
      /* Full-bleed shell + sheet column layout (settings only). */
      "  div[role='presentation']:has(> div[role='dialog'] > nav) { align-items: stretch; padding: 0 !important; }",
      "  div[role='presentation'] > div[role='dialog']:has(> nav) {",
      "    width: 100% !important; max-width: 100vw !important;",
      "    height: 100vh !important; max-height: none !important;",
      "    border-radius: 0; flex-direction: column; overflow: hidden;",
      "  }",
      /* Panel content column (header + options) fills the remaining height. */
      "  div[role='presentation'] > div[role='dialog']:has(> nav) > div {",
      "    flex: 1; min-height: 0; width: 100%;",
      "  }",
      "  div[role='presentation'] > div[role='dialog']:has(> nav) > div > .VOzbGW_options {",
      "    height: 100%; padding: 16px; overflow-y: auto;",
      "    -webkit-overflow-scrolling: touch;",
      "  }",
      /* Directory picker ("Select Workspace Directory"): full-bleed sheet.
       * The built-in dialog is min(680px,100%) wide with a two-pane Miller
       * column (each pane min-width 256px) — on a phone two panes overflow
       * the viewport and the footer wraps to two rows. Restack: full-bleed,
       * panes become full-width scroll-snap pages (the component already
       * auto-scrolls to the newly opened child pane), footer becomes a
       * single scrolling row, safe-area insets throughout. */
      "  .ZuhsRW_dialog.ZuhsRW_dialog {",
      "    width: 100% !important; max-width: 100vw !important;",
      "    height: 100% !important; max-height: 100dvh !important;",
      "    border-radius: 0 !important;",
      "  }",
      "  div[role='presentation']:has(> div[role='dialog'].ZuhsRW_dialog) { align-items: stretch; padding: 0 !important; }",
      "  .ZuhsRW_header { padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px 12px !important; }",
      "  .ZuhsRW_title { font-size: 15px !important; min-height: 24px !important; }",
      "  .ZuhsRW_crumbBar { margin-left: -5px !important; min-height: 30px !important; }",
      "  .ZuhsRW_crumbTrail { flex: 1 1 auto !important; }",
      "  .ZuhsRW_crumb { padding: 4px 2px !important; }",
      "  .ZuhsRW_crumbEditZone { flex: 0 0 40px !important; min-width: 40px !important; }",
      "  .ZuhsRW_content { padding: 8px 12px !important; }",
      /* Miller columns: full-width snap pages; divider hidden. */
      "  .ZuhsRW_millerRow { flex: 1 1 0 !important; scroll-snap-type: x mandatory !important; gap: 0 !important; }",
      "  .ZuhsRW_column {",
      "    flex: 0 0 100% !important; min-width: 0 !important; width: 100% !important;",
      "    scroll-snap-align: start !important; padding-right: 0 !important;",
      "  }",
      "  .ZuhsRW_divider { display: none !important; }",
      "  .ZuhsRW_row { height: 44px !important; padding: 8px 4px !important; }",
      "  .ZuhsRW_rowName { font-size: 14px !important; }",
      /* Footer: single non-wrapping row; scrolls horizontally when tight. */
      "  .ZuhsRW_footerBar {",
      "    flex-wrap: nowrap !important; overflow-x: auto !important;",
      "    padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px) 12px !important;",
      "    gap: 8px !important; scrollbar-width: none !important;",
      "  }",
      "  .ZuhsRW_footerBar::-webkit-scrollbar { display: none !important; }",
      "  .ZuhsRW_footerGap { display: none !important; }",
      "  .ZuhsRW_showHiddenToggle { flex: none !important; padding: 6px 0 !important; white-space: nowrap !important; }",
      "  .ZuhsRW_footerAction { flex: none !important; min-width: 64px !important; }",
      "  .ZuhsRW_status, .ZuhsRW_error { padding: 4px !important; }",
      /* Create-folder dialog: centered card (never full-bleed). */
      "  .ZuhsRW_createDialog.ZuhsRW_createDialog { width: min(380px, 100vw - 32px) !important; }",
      /* Chat scroller: no pull-to-refresh bleed. */
      "  [data-conversation-scroll] { overscroll-behavior-y: contain; }",
      /* Composer: bottom safe-area (home indicator). */
      "  [data-composer-seat] { padding-bottom: env(safe-area-inset-bottom, 0px); }",
      /* Touch targets: no double-tap zoom delay, no tap highlight flash. */
      "  button, [role='button'], a, textarea, input, select { touch-action: manipulation; }",
      "  body { -webkit-tap-highlight-color: transparent; }",
      "}",
      /* Menu buttons (header seat + floating hero button). */
      ".dsm-menu { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; flex: none; }",
      ".dsm-menu:active { background: var(--dsw-alias-interactive-bg-hover); }",
      ".dsm-menu--header { order: -10; }",
      ".dsm-menu--fab { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 10px); left: 10px; z-index: 25; width: 40px; height: 40px; background: var(--dsw-alias-button-floating-fill); box-shadow: var(--dsw-shadow-lv2); color: var(--dsw-alias-label-primary); }",
      /* Backdrop behind the drawer / details sheet. */
      ".dsm-backdrop { position: fixed; inset: 0; z-index: 22; background: var(--dsw-alias-bg-mask-3); }",
    ].join("\n");

    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = PLUGIN_ID;
      tag.dataset.pluginCss = CSS_TAG;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /** Services this plugin's fiber waits for (client cordis inject). */
    const inject = ["layout", "slots", "sessions"];

    /**
     * Client plugin body. `ctx.layout` (ui-layout's LayoutController) and
     * `ctx.slots` (client-runtime's SlotRegistry) are injected; everything
     * else is resolved lazily via ctx.get.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      const layout = ctx.layout;
      const slots = ctx.slots;

      /**
       * Resolve the layout store instance (the same one AppFrame writes):
       * the ui-layout root registration's store handle, minted per scope.
       * @returns the store instance, or null before the root entry mounts.
       */
      const layoutStore = () => {
        try {
          const host = slots.hostFace();
          const entry = host.entriesOf("root")[0];
          if (entry === void 0 || entry.store === void 0) return null;
          return host.storeOf(entry, "root");
        } catch {
          return null;
        }
      };

      /** Subscribe a component to the layout store snapshot (null-safe).
       * The root entry registers after this plugin's apply runs, so the
       * store handle may not exist on first render; re-resolve on each
       * render and fall back to a no-subscribe null snapshot. */
      function useLayoutState() {
        const store = layoutStore();
        return react.useSyncExternalStore(
          store === null ? () => () => {} : (fn) => store.subscribe(fn),
          store === null ? () => null : () => store.getSnapshot(),
          () => null
        );
      }

      /** Close whatever mobile panel is open. */
      function closeMobilePanel(state) {
        if (state === null || state === void 0) return;
        if (state.narrow && state.narrowExpanded) layout.toggleSidebar();
        else if (state.narrow && state.details > 0) layout.closeDetails();
      }

      /* Esc closes the drawer / details sheet on narrow screens. */
      ctx.effect(() => {
        const onKey = (event) => {
          if (event.key !== "Escape") return;
          closeMobilePanel(layoutStore()?.getSnapshot());
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      }, "dsh-mobile: escape close");

      /* Selecting a session from the drawer closes it (it would otherwise
       * cover the newly opened conversation). */
      ctx.effect(() => {
        const sessions = ctx.get("sessions");
        if (sessions === void 0) return () => {};
        let last = sessions.list.getSnapshot().current;
        return sessions.list.subscribe((state) => {
          if (state.current === last) return;
          last = state.current;
          const snapshot = layoutStore()?.getSnapshot();
          if (snapshot !== null && snapshot !== void 0 && snapshot.narrow && snapshot.narrowExpanded) layout.toggleSidebar();
        });
      }, "dsh-mobile: close drawer on session switch");
      /**
       * Hamburger toggle. Header variant lives in the conversation header
       * action seat (only rendered with a session); the fab variant floats
       * over the blank/hero state, where the header (and its menu seat) is
       * hidden. Renders nothing on desktop — the rail toggle already exists.
       */
      function MenuButton({ variant }) {
        const state = useLayoutState();
        if (state === null || !state.narrow) return null;
        const open = state.narrow && state.narrowExpanded;
        const Icon = open ? primitives.IconCloseOutline16 : primitives.IconPanelLeftOutline16;
        const variantName = variant === "fab" ? "fab" : "header";
        return jsxRuntime.jsx("button", {
          type: "button",
          className: "dsm-menu dsm-menu--" + variantName,
          "aria-label": open ? "Close menu" : "Open menu",
          onClick: () => {
            layout.toggleSidebar();
          },
          children: jsxRuntime.jsx(Icon, { size: variantName === "fab" ? 20 : 18 })
        });
      }

      /**
       * Overlay contribution: the drawer/details backdrop and the floating
       * menu button for the blank state. Root-scoped list entry, so it gets
       * the standard `useSessions` seat.
       */
      function MobileOverlay({ useSessions }) {
        const state = useLayoutState();
        const blank = useSessions((s) => {
          const id = s.current;
          return id === void 0 || s.byId[id]?.blank === true;
        });
        const hasSession = useSessions((s) => {
          const id = s.current;
          return id !== void 0 && s.byId[id]?.blank === false;
        });
        if (state === null) return null;
        const narrow = state.narrow;
        const drawer = narrow && state.narrowExpanded;
        const details = narrow && state.details > 0 && hasSession;
        /* Mirror drawer/details to attributes on the frame so the CSS can
         * key the drawer and sheet off the real store state (see the
         * data-dsm-details comment above). */
        const frame = document.querySelector("div:has(> div[data-shell-overlay])");
        if (frame !== null) {
          frame.toggleAttribute("data-dsm-drawer", drawer);
          frame.toggleAttribute("data-dsm-details", details);
        }
        return jsxRuntime.jsxs(jsxRuntime.Fragment, {
          children: [
            drawer && jsxRuntime.jsx("div", {
              className: "dsm-backdrop",
              "data-mobile-backdrop": "",
              onClick: () => {
                layout.toggleSidebar();
              }
            }),
            details && jsxRuntime.jsx("div", {
              className: "dsm-backdrop",
              "data-mobile-backdrop": "details",
              onClick: () => {
                layout.closeDetails();
              }
            }),
            narrow && blank && jsxRuntime.jsx(MenuButton, { variant: "fab" })
          ]
        });
      }

      /* Header seat: the hamburger, first among the session header actions. */
      slots.inject("conversation.session.header.actions", () => slots.register({
        name: "conversation.session.header.actions",
        id: "dsh-mobile-menu",
        order: -20
      }, MenuButton));

      /* Root overlay: backdrop + hero floating menu. */
      slots.inject("shell.overlay", () => slots.register({
        name: "shell.overlay",
        id: "dsh-mobile-overlay",
        order: -20
      }, MobileOverlay));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
