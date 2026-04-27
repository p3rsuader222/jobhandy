# Jobhandy Extension – Beginner Install Guide

This guide walks you through installing the Jobhandy Chrome extension from start to finish. No technical experience needed — just follow the steps in order.

## What you need before you start

- A computer running **Google Chrome**
- A spreadsheet of brand names in column A (`.xlsx`, `.csv`, or `.txt`)
- About 5 minutes

---

## 1) Download the extension

1. Open this link in Chrome: https://github.com/p3rsuader222/jobhandy
2. Near the top of the file list there's a **branch dropdown** (it usually shows `main`). Click it and select **`latest`** — that branch has the newest version.
3. On the right side, click the green **`Code`** button.
4. At the bottom of the dropdown, click **`Download ZIP`**.
5. Save the ZIP file somewhere easy to find, like your **Desktop**.

You should now have a file named something like `jobhandy-latest.zip`.

---

## 2) Extract the ZIP

A ZIP is a compressed bundle. Chrome can't run it directly — you have to unpack it first.

1. Go to where you saved the ZIP (Desktop, Downloads, etc.).
2. **Right-click** on the ZIP file.
3. Click **`Extract All...`** from the menu.
4. A small window pops up asking where to put the extracted files. Leave the default (next to the ZIP) or change it to **Desktop**. Click **`Extract`**.
5. A new folder appears — for example `jobhandy-latest`. Open it once and check that there's a file named **`manifest.json`** inside. If yes, you're good.

> **Don't delete this folder.** Chrome reads from it every time you use the extension. If you delete it, the extension breaks.

---

## 3) Install in Chrome

1. Open Chrome.
2. Click the address bar, type `chrome://extensions`, and press **Enter**.
3. In the **top-right** of that page, find the **`Developer mode`** switch. Turn it **ON** (it goes blue).
4. Three new buttons appear in the top-left. Click **`Load unpacked`**.
5. A folder picker opens. Browse to and click your extracted `jobhandy-latest` folder. Click **`Select Folder`**.

A `Jobhandy` card now appears on the page. The extension is installed.

> **If Chrome says "Manifest file is missing or unreadable":** you picked the wrong folder. Open the folder you selected — if it doesn't have `manifest.json` directly inside, the actual extension folder is nested one level deeper. Pick that inner folder instead.

---

## 4) Pin the extension to the toolbar

By default, Chrome hides extensions inside a puzzle-piece menu. Pin Jobhandy so it's always one click away.

1. In the **top-right of Chrome**, click the **puzzle-piece icon** (looks like a jigsaw piece, next to your profile picture).
2. A small list of installed extensions appears.
3. Find **`Jobhandy`** in that list.
4. Click the **pin icon** on its right (looks like a thumbtack). The icon turns blue.
5. The Jobhandy logo now sits permanently in your Chrome toolbar.

---

## 5) Run the extension

1. In Chrome, log into your seller account and open the **brand exemptions** page (the one with the yellow filter and `Atnaujinti` button).
2. Make sure that tab is the one you're looking at — Jobhandy only acts on the active tab.
3. Click the **Jobhandy icon** in the toolbar to open the popup.
4. **Upload your file** by either dragging it onto the upload zone or clicking the zone and browsing for it.
   - The first column (column A) of the file is read. Put one brand per row.
5. The popup confirms how many names were loaded.
6. Choose your run mode:
   - **`Process Next Item`** — handles one brand at a time. Use this the first few times so you can watch what's happening.
   - **`Run Full Automation`** — works through the whole list.
7. When all rows are processed, click the seller page's confirm button (`Atnaujinti`) yourself, **or** click **`Click Final Confirm`** in the popup.

### Brands that don't match

If the seller page doesn't have an exact match for a brand on your list, the extension marks it as **unmatched** instead of guessing. Those brands appear in a red-bordered **Unmatched Brands** panel inside the popup. You can add them manually on the page if needed.

---

## 6) Update to a new version

1. Re-download the ZIP from GitHub (Step 1).
2. Extract it (Step 2).
3. **Replace the old folder**: delete the old extracted folder (e.g. `jobhandy-latest`) and put the new one in the same place with the same name.
4. Go back to `chrome://extensions`.
5. On the Jobhandy card, click the **circular reload arrow** (between the toggle switch and the Details button). This is mandatory — Chrome won't pick up the new code on its own.
6. Refresh any open seller-page tabs.

---

## 7) Troubleshooting

**Clicking the icon shows an error like "Open a supported brand-exemptions page".**
The extension is rejecting the active tab. Make sure you're on the actual seller brand-exemptions URL (something like `tvs.pigu.lt/marketplace/seller_brand_exemptions/...`) and that tab is in front when you click the icon.

**All buttons in the popup are greyed out.**
You haven't uploaded a file yet. Drag your spreadsheet onto the upload zone or click it and pick the file.

**It worked yesterday, today nothing happens.**
You probably updated the folder but didn't reload the extension. Go to `chrome://extensions` and click the **circular reload arrow** on the Jobhandy card.

**The extension clicked the wrong brand.**
It shouldn't — matching is now strict. If you see this, double-check the brand name in your file matches the seller page's brand text exactly (extra spaces, different capitalization, accents, etc. are normalized but other characters are not).

**My file has more than 500 brands.**
The extension stops there for safety. Split the file into chunks of 500 or fewer and run them one after another.

**Stopped after 5 consecutive misses.**
Five brands in a row didn't match — usually means you're on the wrong page, or the brand list and the seller page don't overlap. Check both, then click `Reset progress` and try again.

**Where do I see what was added vs. skipped?**
The progress bar shows how many were processed. The status bar shows the final summary. Skipped brands are listed in the Unmatched Brands panel.
