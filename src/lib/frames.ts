// The viewer panel shows axis.com pages, which send X-Frame-Options / frame-ancestors.
// public/main.js strips those for frames our page opens (initiator = extension), but the
// login hops on by itself (eu.login.connect.axis.com → auth.axis.com), and those requests
// are started by axis.com. This rule covers every axis.com frame inside our own tabs;
// other tabs keep axis.com's protection.

const TAB_RULE_ID = 2;

export async function allowAxisFramesInThisTab() {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id == null) return;
  const [old] = await chrome.declarativeNetRequest.getSessionRules({ ruleIds: [TAB_RULE_ID] });
  // Tab ids are not reused within a browser session, so older ids are harmless.
  const tabIds = [...new Set([...(old?.condition.tabIds ?? []), tab.id])];
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [TAB_RULE_ID],
    addRules: [{
      id: TAB_RULE_ID,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders: [
          { header: "x-frame-options", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
          { header: "content-security-policy", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
        ],
      },
      condition: {
        requestDomains: ["axis.com"],
        tabIds,
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.SUB_FRAME],
      },
    }],
  });
}
