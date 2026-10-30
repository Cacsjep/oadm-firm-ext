# Privacy policy

**OADM Firmware Downloader for AXIS devices** (the "extension")
Effective 2026-10-30

The extension collects no personal data. It has no servers of its own, no analytics, no tracking and no ads.
Everything it keeps stays in your browser.

## What the extension accesses

| What | Why | Leaves your browser? |
| --- | --- | --- |
| Firmware listings on `www.axis.com` (`/ftp/pub_soft/`) | Show products and their firmware versions | Requests go to axis.com only |
| Release notes on `help.axis.com` | Link each version to its release notes | Requests go to axis.com only |
| The `axis_auth` cookie of axis.com | Tell whether you are signed in to My Axis; only its presence and expiry are read | No |
| Your axis.com session (sent by the browser with axis.com requests) | Download firmware, which axis.com allows only when signed in | Sent to axis.com only, as with any axis.com visit |
| A device file you import (OADM `.csv` or AXIS Device Manager `.json`) | Find updates for your devices | No |

From an imported file the extension keeps only the **model** and **firmware version** of each device and the file
name. Addresses, MAC addresses, host names, tags, user names and passwords in the file are not read into the
extension or stored. An encrypted AXIS Device Manager export is refused.

## What is stored, and where

In `chrome.storage.local` in your browser profile:

- the product index and release-note links (a cache, refreshed every 12 hours)
- your download list and the source filter (Cameras, Audio & other)
- the imported device list (model, firmware version, file name) and the versions you chose

Nothing is synced or sent to anyone. **Clear** in the imported devices and download list removes those entries;
removing the extension removes all of it.

## Links and sign-in

Release notes and product pages open in a normal browser tab, and the My Axis login in a normal (popup) browser
window. These are axis.com pages under Axis's own privacy policy; the extension does not read or change their
content. For the sign-in window it opened, it watches only the address, to close the window as soon as the sign-in
returns to axis.com.

## Downloads

Firmware files are downloaded by Chrome from axis.com to your downloads folder, under the terms Axis publishes
there.

## Third parties

The extension talks to Axis Communications AB (`axis.com`) only. Their handling of your data is described in
[Axis's privacy policy](https://www.axis.com/privacy).

## Changes and contact

Changes to this policy are made in this file, and its history is public in the repository. Questions:
[open an issue](https://github.com/Cacsjep/oadm-firm-ext/issues).

OADM is an independent project. It is not affiliated with, sponsored by, or endorsed by Axis Communications AB.
AXIS is a trademark of Axis AB.
