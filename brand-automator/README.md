# Brand List Automator

Chrome extension for a repetitive internal-tool workflow:

1. Read names from column A in an uploaded `.xlsx`, `.csv`, or `.txt` file.
2. Use the already open and already logged-in `pigu.lt` tab.
3. Press `Process Next Item` once for each row you want to move.
4. The extension types the next name into the yellow filter field, clicks the matching green item in the left list, and clicks the red `>>` button.
5. Press `Click Final Confirm` only when you are satisfied with the accumulated changes.

No login flow is included in this extension. It only works against the active tab and the session that is already open in Chrome.

## Safety Guardrails

- Final confirm is off by default, so the user can review the right-side list before committing changes.
- The run is limited to 500 items at a time.
- The run stops if 5 names in a row cannot be matched on the page.
- The run stops if the tab navigates to a different URL during automation.
- The run also has a hard timeout, so it cannot wait forever.
- The safest mode is the manual `Process Next Item` button, which performs only one iteration per click.

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select the `brand-automator` folder.

## Notes

- If your source file is old `.xls`, open it in Excel and save it as `.xlsx` first.
- Production selector fields are prefilled by default for the current pigu page structure.
- If the page structure is unusual, fill in the advanced CSS selector fields in the popup.
- Keeping only the target internal-system tab open makes it easier to avoid sending the automation to the wrong page.

### Color Mapping (Production Screen)

- Yellow: filter field where Excel text is typed.
- Green: item that appears in the left list and must be clicked.
- Red: `>>` button pressed after green item is selected.
- Blue: `Atnaujinti` clicked once after all rows are processed.

## Local Test Page

You can test the extension safely without touching the company system.

1. Start a local server from the `brand-automator` folder.
2. Open `http://localhost:8000/test-page.html` in Chrome.
3. In extension settings, enable `Enable localhost test pages`.
4. Use these selectors in the extension:
   - Filter field: `#brand-filter`
   - Left list item: `#available-list li`
   - Move right button: `#move-right-btn`
   - Final confirm button: `#confirm-btn`

Example server commands:

```powershell
cd d:\MAINMANDEE\CODELEARN\jobhandy\brand-automator
python -m http.server 8000
```
