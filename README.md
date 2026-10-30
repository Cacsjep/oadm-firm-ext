# OADM Firmware Downloader for AXIS devices

**An independent open source project. Not affiliated with or endorsed by Axis Communications AB. AXIS is a trademark of Axis AB.**

A Chrome extension that finds and batch-downloads AXIS OS firmware from axis.com, part of the
[OADM](https://oadm.app) suite. It uses your own axis.com sign-in: nothing is downloaded or stored anywhere else.

## Features

- **Product search** across cameras, audio and other devices, with the latest build of every AXIS OS track
  (LTS and active) and links to the release notes.
- **Import devices** from an OADM device export (`.csv`) or an AXIS Device Manager export (`.json`, format 1.x
  and 2.x). Models are matched to their products, and each row gets an update version: recommended (stays on
  the device's track), latest LTS or active track, or any version you pick.
- **Download list** that queues the firmware files and downloads them in one go through Chrome.
- **Sign-in check**: downloads need a My Axis account, so the extension asks you to sign in first, right in
  its side panel.

## Install

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run build
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `dist` folder.
Click the extension icon to open it in a tab.

## Develop

```sh
npm run dev   # rebuilds dist/ on every change; reload the extension to see it
```

Built with Vue 3, Vite, Tailwind CSS and [shadcn-vue](https://www.shadcn-vue.com/). The app lives in `src/`,
and the extension files that are copied as they are (manifest, service worker, content script, icon) in `public/`.

## Publish

```sh
npm run zip            # builds and writes release/oadm-firmware-downloader-<version>.zip
npm run store:images   # renders the store tiles from store/images/src/
```

Store listing texts, permission justifications and privacy answers: [store/LISTING.md](store/LISTING.md).
Screenshot plan: [store/SCREENSHOTS.md](store/SCREENSHOTS.md). Privacy policy: [PRIVACY.md](PRIVACY.md).

## How it works

Firmware listings are read from the axis.com download index (`/ftp/pub_soft/`), and downloads go through
`chrome.downloads` with your browser's axis.com cookies. The extension removes axis.com's frame-blocking headers
only for pages shown in its own tab, so they can open in the side panel; every other tab keeps axis.com's
protection. Nothing is collected or sent anywhere else; see the [privacy policy](PRIVACY.md).

## Trademarks

OADM is an independent project. It is not affiliated with, sponsored by, or endorsed by Axis Communications AB.
AXIS is a trademark of Axis AB. Product names are used only to identify the products the firmware belongs to.
Firmware is downloaded from axis.com under the terms Axis publishes there.

## License

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). © 2026 The OADM contributors.
