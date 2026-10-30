// Service worker: clicking the toolbar icon opens (or focuses) the full-tab UI.
// Downloads themselves go through chrome.downloads from the page, which uses the
// browser's cookie jar, so a logged-in axis.com session is reused automatically.

const APP_URL = chrome.runtime.getURL("index.html");

chrome.action.onClicked.addListener(async () => {
  // getContexts finds our own tab without needing the "tabs" permission.
  const [ctx] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [APP_URL] });
  if (ctx) {
    await chrome.tabs.update(ctx.tabId, { active: true });
    await chrome.windows.update(ctx.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: APP_URL });
  }
});
