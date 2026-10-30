# Chrome Web Store listing

Everything the Chrome Web Store developer dashboard asks for, ready to paste. Images are in [`images/`](images),
the screenshot plan in [SCREENSHOTS.md](SCREENSHOTS.md). Build the upload with `npm run zip`.

## Package

| Field | Value |
| --- | --- |
| Upload | `release/oadm-firmware-downloader-<version>.zip` (from `npm run zip`) |
| Version | from `public/manifest.json`; raise it for every upload |

## Store listing tab

**Name** (from the manifest)

```
OADM Firmware Downloader for AXIS devices
```

**Summary** (from the manifest, 124 of 132 characters)

```
Find AXIS OS firmware, import devices from OADM or AXIS Device Manager and batch-download updates with your My Axis account.
```

**Description**

```
Find and download AXIS OS firmware for your Axis devices, fast.

Part of OADM (Open AXIS Device Management, https://oadm.app), free and open source.

PRODUCT SEARCH
Type a model name and see the newest build of every AXIS OS track at a glance: the active track and each LTS track (LTS 2022, LTS 2024, LTS 2026 …), with release dates and release notes. Add the versions you need to the download list.

UPDATES FOR ALL YOUR DEVICES
Import your device list and get the right firmware for every model at once:
• OADM device export (.csv)
• AXIS Device Manager export (.json, file format 1.x and 2.x)
Each model gets an update version: recommended (stays on the track the device runs), latest LTS, active track, or any version you pick. Lens variants and older products are found too. Only the model and firmware version of each device are read from the file.

BATCH DOWNLOAD
Queue firmware from many products and download everything in one go, with progress per file.

YOUR MY AXIS ACCOUNT
Axis firmware downloads need a signed-in My Axis account. The extension tells you when you are signed out and lets you sign in right in its side panel.

PRIVATE BY DESIGN
No servers of its own, no analytics, no tracking. The extension talks to axis.com only, and everything it keeps stays in your browser.

Open source (Apache-2.0): https://github.com/Cacsjep/oadm-firm-ext

OADM is an independent project. It is not affiliated with, sponsored by, or endorsed by Axis Communications AB. AXIS is a trademark of Axis AB.
```

| Field | Value |
| --- | --- |
| Category | Developer Tools |
| Language | English |
| Store icon | `images/store-icon-128.png` |
| Screenshots | 1280×800, see [SCREENSHOTS.md](SCREENSHOTS.md) |
| Small promo tile | `images/promo-small-440x280.png` |
| Marquee promo tile (optional) | `images/promo-marquee-1400x560.png` |
| Official URL | none (needs a verified site) |
| Homepage URL | `https://oadm.app` |
| Support URL | `https://github.com/Cacsjep/oadm-firm-ext/issues` |

## Privacy practices tab

**Single purpose**

```
Find AXIS OS firmware on axis.com and download it, for single products or for a whole imported device list, using the user's own My Axis account.
```

**Permission justification**

| Permission | Justification |
| --- | --- |
| `downloads` | Saves the firmware files the user queued from axis.com to the downloads folder and shows their progress. |
| `cookies` | Reads whether the axis.com sign-in cookie (axis_auth) exists, to tell the user to sign in before downloading. Only its presence and expiry are used; nothing is stored or sent. |
| `storage` | Keeps the download list, the imported device list (model and firmware version only), the product index cache and settings in the browser. |
| `declarativeNetRequestWithHostAccess` | Removes axis.com's frame-blocking headers only for frames inside the extension's own tab, so the My Axis login and AXIS OS release notes can open in the extension's side panel. All other tabs keep axis.com's headers. |
| Host permission `https://www.axis.com/*`, `https://*.axis.com/*` | Reads the firmware listings and release notes on axis.com, downloads firmware with the user's axis.com session, and shows axis.com pages (login, release notes, product pages) in the side panel. The login uses several axis.com subdomains. |
| Content script on `https://*.axis.com/*` | Hides the axis.com cookie banner, and only when the page is shown inside the extension's side panel (the banner's consent cookie cannot be stored in that frame, so it would reappear on every page). It does nothing in normal tabs. |

**Remote code**

```
No, I am not using remote code.
```

All JavaScript is bundled in the package; the extension loads no scripts from elsewhere.

**Data usage**

Data collected: none. Tick none of the data types.

Certify all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**

```
https://github.com/Cacsjep/oadm-firm-ext/blob/master/PRIVACY.md
```

## Distribution tab

| Field | Value |
| --- | --- |
| Visibility | Public |
| Regions | All regions |
| Payments | Free |

## Notes for review

If the review asks about the header removal, the short answer: the rule is limited to `sub_frame` requests in the
extension's own tab (`tabIds`) and to frames the extension's page opens (`initiatorDomains`); see `public/main.js`
and `src/lib/frames.ts`.
