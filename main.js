// Service worker: clicking the toolbar icon opens (or focuses) the full-tab UI.
// Downloads themselves go through chrome.downloads from the page, which uses the
// browser's cookie jar, so a logged-in axis.com session is reused automatically.

const APP_URL = chrome.runtime.getURL("index.html");

// www.axis.com sends X-Frame-Options: SAMEORIGIN, which blocks the in-app viewer.
// Strip it (and any frame-ancestors CSP) only for frames our own page opens, so
// axis.com stays protected everywhere else.
const FRAME_RULE_ID = 1;

async function installFrameRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [FRAME_RULE_ID],
    addRules: [{
      id: FRAME_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          { header: "content-security-policy", operation: "remove" },
        ],
      },
      condition: {
        requestDomains: ["axis.com"],
        initiatorDomains: [chrome.runtime.id],
        resourceTypes: ["sub_frame"],
      },
    }],
  });
}

chrome.runtime.onInstalled.addListener(installFrameRule);
chrome.runtime.onStartup.addListener(installFrameRule);

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
