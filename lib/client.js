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
 *  4. Touch polish: safe-area insets for notched phones, overscroll
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
