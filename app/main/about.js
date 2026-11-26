/**
 * The page of the About window, as one string. A native message box cannot do this layout (its text always sits
 * next to the icon, and the version cannot sit under the name in the normal font), so About is a small window
 * with a data: page: the icon, the name and the version on top, the rest of the text over the full width.
 * No script and no link, so the page needs no preload and no bridge; the text is escaped here.
 */

export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * @param {{name: string, version: string, iconUrl: string, paragraphs: string[], dark?: boolean}} content  `iconUrl` is a data: URL;
 *   `dark` is the system theme as the main process knows it: the page uses its own colours, because on Windows the page's
 *   `prefers-color-scheme` stays light under a dark system theme and the text would be black on the dark window
 * @returns {string}
 */
export function aboutHtml({ name, version, iconUrl, paragraphs, dark = false }) {
  const body = paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>About ${escapeHtml(name)}</title>
<style>
  :root { color-scheme: ${dark ? 'dark' : 'light'}; }
  body { background: ${dark ? '#1e1e1e' : '#ffffff'}; color: ${dark ? '#f0f0f0' : '#1a1a1a'}; margin: 0; padding: 24px 28px 26px; font: 13.5px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  header { display: flex; align-items: center; gap: 16px; }
  img { width: 64px; height: 64px; }
  h1 { margin: 0; font-size: 20px; font-weight: 600; }
  .version { margin: 2px 0 0; font-size: 14px; font-weight: 400; opacity: 0.8; }
  p { margin: 14px 0 0; overflow-wrap: anywhere; }
</style>
</head>
<body>
<header>
<img src="${escapeHtml(iconUrl)}" alt="">
<div>
<h1>${escapeHtml(name)}</h1>
<div class="version">Version ${escapeHtml(version)}</div>
</div>
</header>
${body}
</body>
</html>
`;
}

/**
 * True when the About window must stay above the others: some other window is "Always on top" (the tank window in window
 * mode). Without it a window that is always on top covers About, which opens as a window of its own.
 * @param {Array<{isAlwaysOnTop: () => boolean, isDestroyed?: () => boolean}>} windows  every window of the app
 * @param {unknown} [except]  the About window itself
 */
export function aboutStaysOnTop(windows, except) {
  return windows.some((w) => w !== except && !w.isDestroyed?.() && w.isAlwaysOnTop());
}
