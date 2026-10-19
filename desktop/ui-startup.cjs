"use strict";

/** Refresh interface files without deleting cookies, local storage or linked-folder state. */
async function loadCurrentUI(window, target, log = console.log) {
  await window.webContents.session.clearCache();
  const view = target.searchParams.has("legacy")
    ? "legacy workflow"
    : target.searchParams.has("catalogue")
      ? "catalogue explorer"
      : "workspace";
  log(
    `[EthicSpark] Loading ${target.origin}${target.pathname} (${view}); interface cache refreshed.`,
  );
  await window.loadURL(target.href, {
    extraHeaders: "Cache-Control: no-cache\nPragma: no-cache\n",
  });
}
module.exports = { loadCurrentUI };
