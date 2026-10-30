// Runs in axis.com frames. Only when the frame sits inside our viewer panel, hide
// the cookie banner: its consent cookie is SameSite=Strict, so Chrome drops it in
// this cross-site frame and the banner would reappear on every open. Hiding it
// accepts nothing; the page keeps running with necessary cookies only.
if (window !== window.top && location.ancestorOrigins?.[0] === chrome.runtime.getURL("").replace(/\/$/, "")) {
  const style = document.createElement("style");
  style.textContent = "cookie-consent, #AxisCCDiv { display: none !important; }";
  document.documentElement.appendChild(style);
}
