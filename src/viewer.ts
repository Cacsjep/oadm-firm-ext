// Page viewer sheet (right). External links open here instead of a new tab;
// links marked data-external (sign-in, "open in new tab") keep their normal behaviour.

import { reactive } from "vue";

export const viewer = reactive({ open: false, url: "", title: "", loading: false, loads: 0 });

export function openViewer(url: string, title?: string) {
  const sameDoc = viewer.url.split("#")[0] === url.split("#")[0];
  // A hash change on the same page only scrolls, so no load event will fire.
  viewer.loading = !sameDoc;
  viewer.url = url;
  viewer.title = title || new URL(url).hostname;
  viewer.open = true;
}
