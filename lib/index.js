/**
 * @deepseek-ai/dsh-mobile — mobile-first overlay for the DeepSeek Harness
 * browser UI.
 *
 * Host loader entry: this plugin is a dual-face package. The node half is a
 * no-op (`apply` provides no host-side behavior); the browser half is the
 * `dsh.client` bundle served by client-modules at `/plugins/<id>/client.js`
 * and adopted as a client-side cordis entry by the web shell. All behavior —
 * viewport CSS overrides, the sidebar drawer, the header hamburger, and the
 * composer polish — lives in the browser half, so nothing here runs on the
 * host process.
 */

/** Stable Cordis plugin name. */
const name = "dsh-mobile";

/** Host loader entry for the browser-only mobile overlay plugin. */
function apply() {}

export { apply, name };
