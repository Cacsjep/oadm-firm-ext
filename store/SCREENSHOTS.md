# Screenshots

The store takes 1 to 5 screenshots, 1280×800 (or 640×400), PNG or JPEG. They need the extension running with a
signed-in My Axis session, so they are taken by hand. Save them here as `images/screenshot-1.png` …

## Setup

1. `npm run build`, load `dist/` in `chrome://extensions`, sign in to My Axis.
2. Size the page to exactly 1280×800: open DevTools (F12), toggle the device toolbar (Ctrl+Shift+M), choose
   **Responsive** and type 1280 × 800.
3. DevTools menu (⋮) → **Capture screenshot**.

Use a dark system theme for all of them, or a light one for all; do not mix.

## Shots, in this order

1. **Imported devices.** Import a device list with several models (an OADM `.csv` works). Show the table with
   versions loaded and the version select at **Recommended**.
2. **Version picker.** The same table with one row's version dropdown open, showing tracks (LTS, Active) and a
   product with lens variants (P1455-LE).
3. **Product view.** Search a current camera (for example `P3265-LVE`) with no import, so the track cards show:
   Active, LTS 2026, LTS 2024.
4. **Download list.** A few files queued and one downloading, with its progress bar.
5. **Release notes in the side panel.** Click a card's **Release notes** so the panel is open beside the app.

Keep real device data out of the shots: use a sample list, and blur or avoid file names that identify a customer.
