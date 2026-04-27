const STORAGE_KEYS = {
  names: "brandAutomatorNames",
  settings: "brandAutomatorSettings",
  status: "brandAutomatorStatus",
  progress: "brandAutomatorProgress",
  unmatched: "brandAutomatorUnmatched",
};

const DEFAULT_SETTINGS = {
  delay: 700,
  skipFirstRow: false,
  clickConfirm: false,
  allowTestPages: false,
  inputSelector: "#brand-input-autocomplete",
  listItemSelector: "#brands-autocomplete-list > li",
  addButtonSelector: "#add-option-btn",
  confirmButtonSelector: "#seller_brand_exemptions > div > div > button",
};

const state = {
  names: [],
  status: null,
  progressIndex: 0,
  unmatched: [],
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  await Promise.all([loadSettings(), loadNames(), loadProgress(), loadStatus(), loadUnmatched()]);
  renderProgress();
  chrome.storage.onChanged.addListener(handleStorageChange);
}

function cacheElements() {
  elements.uploadZone = document.getElementById("upload-zone");
  elements.fileInput = document.getElementById("file-input");
  elements.previewBox = document.getElementById("preview-box");
  elements.previewList = document.getElementById("preview-list");
  elements.countBadge = document.getElementById("count-badge");
  elements.btnClear = document.getElementById("btn-clear");
  elements.delay = document.getElementById("delay");
  elements.skipFirstRow = document.getElementById("skip-first-row");
  elements.clickConfirm = document.getElementById("click-confirm");
  elements.allowTestPages = document.getElementById("allow-test-pages");
  elements.inputSelector = document.getElementById("input-selector");
  elements.listItemSelector = document.getElementById("list-item-selector");
  elements.addButtonSelector = document.getElementById("add-button-selector");
  elements.confirmButtonSelector = document.getElementById("confirm-button-selector");
  elements.progressArea = document.getElementById("progress-area");
  elements.progressBar = document.getElementById("progress-bar");
  elements.progressText = document.getElementById("progress-text");
  elements.currentItemHint = document.getElementById("current-item-hint");
  elements.status = document.getElementById("status");
  elements.btnStep = document.getElementById("btn-step");
  elements.btnConfirmFinal = document.getElementById("btn-confirm-final");
  elements.btnStart = document.getElementById("btn-start");
  elements.btnResetProgress = document.getElementById("btn-reset-progress");
  elements.btnStop = document.getElementById("btn-stop");
  elements.unmatchedBox = document.getElementById("unmatched-box");
  elements.unmatchedList = document.getElementById("unmatched-list");
  elements.unmatchedCount = document.getElementById("unmatched-count");
  elements.btnClearUnmatched = document.getElementById("btn-clear-unmatched");
}

function bindEvents() {
  elements.uploadZone.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (file) {
      await handleFile(file);
    }
  });

  elements.uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.uploadZone.classList.add("drag-over");
  });

  elements.uploadZone.addEventListener("dragleave", () => {
    elements.uploadZone.classList.remove("drag-over");
  });

  elements.uploadZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    elements.uploadZone.classList.remove("drag-over");
    const [file] = event.dataTransfer?.files || [];
    if (file) {
      await handleFile(file);
    }
  });

  elements.btnClear.addEventListener("click", async () => {
    state.names = [];
    state.progressIndex = 0;
    state.status = null;
    state.unmatched = [];
    elements.fileInput.value = "";
    await chrome.storage.local.remove([
      STORAGE_KEYS.names,
      STORAGE_KEYS.status,
      STORAGE_KEYS.progress,
      STORAGE_KEYS.unmatched,
    ]);
    renderNames();
    renderProgress();
    renderUnmatched();
    hideStatus();
  });

  elements.btnClearUnmatched.addEventListener("click", async () => {
    state.unmatched = [];
    await chrome.storage.local.remove(STORAGE_KEYS.unmatched);
    renderUnmatched();
  });

  [
    elements.delay,
    elements.skipFirstRow,
    elements.clickConfirm,
    elements.allowTestPages,
    elements.inputSelector,
    elements.listItemSelector,
    elements.addButtonSelector,
    elements.confirmButtonSelector,
  ].forEach((input) => {
    input.addEventListener("input", saveSettings);
    input.addEventListener("change", saveSettings);
  });

  elements.btnStep.addEventListener("click", processNextItem);
  elements.btnConfirmFinal.addEventListener("click", clickFinalConfirm);
  elements.btnStart.addEventListener("click", startAutomation);
  elements.btnResetProgress.addEventListener("click", resetProgress);
  elements.btnStop.addEventListener("click", stopAutomation);
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] || {}) };
  settings.inputSelector = settings.inputSelector?.trim() || DEFAULT_SETTINGS.inputSelector;
  settings.listItemSelector = settings.listItemSelector?.trim() || DEFAULT_SETTINGS.listItemSelector;
  settings.addButtonSelector = settings.addButtonSelector?.trim() || DEFAULT_SETTINGS.addButtonSelector;
  settings.confirmButtonSelector = settings.confirmButtonSelector?.trim() || DEFAULT_SETTINGS.confirmButtonSelector;

  elements.delay.value = settings.delay;
  elements.skipFirstRow.checked = settings.skipFirstRow;
  elements.clickConfirm.checked = settings.clickConfirm;
  elements.allowTestPages.checked = settings.allowTestPages;
  elements.inputSelector.value = settings.inputSelector;
  elements.listItemSelector.value = settings.listItemSelector;
  elements.addButtonSelector.value = settings.addButtonSelector;
  elements.confirmButtonSelector.value = settings.confirmButtonSelector;
}

async function saveSettings() {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: collectSettings() });
}

function collectSettings() {
  return {
    delay: clampNumber(Number(elements.delay.value), 150, 5000, DEFAULT_SETTINGS.delay),
    skipFirstRow: elements.skipFirstRow.checked,
    clickConfirm: elements.clickConfirm.checked,
    allowTestPages: elements.allowTestPages.checked,
    inputSelector: elements.inputSelector.value.trim(),
    listItemSelector: elements.listItemSelector.value.trim(),
    addButtonSelector: elements.addButtonSelector.value.trim(),
    confirmButtonSelector: elements.confirmButtonSelector.value.trim(),
  };
}

async function loadNames() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.names);
  if (Array.isArray(stored[STORAGE_KEYS.names])) {
    state.names = stored[STORAGE_KEYS.names];
  }
  renderNames();
}

async function loadProgress() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.progress);
  state.progressIndex = clampNumber(
    Number(stored[STORAGE_KEYS.progress]?.currentIndex || 0),
    0,
    100000,
    0,
  );
}

async function loadStatus() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.status);
  state.status = stored[STORAGE_KEYS.status] || null;
  renderStatus(state.status);
}

async function loadUnmatched() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.unmatched);
  state.unmatched = Array.isArray(stored[STORAGE_KEYS.unmatched]) ? stored[STORAGE_KEYS.unmatched] : [];
  renderUnmatched();
}

function handleStorageChange(changes, areaName) {
  if (areaName !== "local") {
    return;
  }

  if (changes[STORAGE_KEYS.status]) {
    state.status = changes[STORAGE_KEYS.status].newValue || null;
    renderStatus(state.status);
  }

  if (changes[STORAGE_KEYS.names]) {
    state.names = Array.isArray(changes[STORAGE_KEYS.names].newValue)
      ? changes[STORAGE_KEYS.names].newValue
      : [];
    renderNames();
  }

  if (changes[STORAGE_KEYS.progress]) {
    state.progressIndex = clampNumber(
      Number(changes[STORAGE_KEYS.progress].newValue?.currentIndex || 0),
      0,
      100000,
      0,
    );
    renderProgress();
    updateActionButtons();
  }

  if (changes[STORAGE_KEYS.unmatched]) {
    state.unmatched = Array.isArray(changes[STORAGE_KEYS.unmatched].newValue)
      ? changes[STORAGE_KEYS.unmatched].newValue
      : [];
    renderUnmatched();
  }
}

async function handleFile(file) {
  try {
    const settings = collectSettings();
    await saveSettings();
    const names = await parseSpreadsheetFile(file, settings);

    if (!names.length) {
      throw new Error("No non-empty values were found in column A.");
    }

    state.names = names;
    state.status = null;
    state.unmatched = [];
    await chrome.storage.local.set({ [STORAGE_KEYS.names]: names });
    await chrome.storage.local.remove([STORAGE_KEYS.status, STORAGE_KEYS.unmatched]);
    await saveProgressIndex(0);
    renderNames();
    renderUnmatched();
    showStatus("success", `Loaded ${names.length} name${names.length === 1 ? "" : "s"} from ${file.name}.`);
  } catch (error) {
    showStatus("error", error.message || "Failed to load the file.");
  }
}

function renderNames() {
  const names = state.names;
  elements.previewBox.style.display = names.length ? "block" : "none";
  elements.countBadge.textContent = String(names.length);
  elements.previewList.innerHTML = "";

  const previewLimit = 80;
  names.slice(0, previewLimit).forEach((name) => {
    const item = document.createElement("li");
    item.textContent = name;
    elements.previewList.appendChild(item);
  });

  if (names.length > previewLimit) {
    const item = document.createElement("li");
    item.textContent = `...and ${names.length - previewLimit} more`;
    elements.previewList.appendChild(item);
  }

  renderProgress();
  updateActionButtons();
}

function renderStatus(status) {
  if (!status) {
    hideStatus();
    updateActionButtons();
    return;
  }

  if (status.message) {
    const kind = status.state === "completed"
      ? "success"
      : status.state === "error"
        ? "error"
        : status.state === "stopped"
          ? "warn"
          : "info";
    showStatus(kind, status.message);
  } else {
    hideStatus();
  }

  updateActionButtons();
}

function renderUnmatched() {
  const items = state.unmatched;
  elements.unmatchedBox.style.display = items.length ? "block" : "none";
  elements.unmatchedCount.textContent = String(items.length);
  elements.unmatchedList.innerHTML = "";

  const previewLimit = 80;
  items.slice(0, previewLimit).forEach((name) => {
    const item = document.createElement("li");
    item.textContent = name;
    elements.unmatchedList.appendChild(item);
  });

  if (items.length > previewLimit) {
    const item = document.createElement("li");
    item.textContent = `...and ${items.length - previewLimit} more`;
    elements.unmatchedList.appendChild(item);
  }
}

function renderProgress() {
  const total = state.names.length;
  const done = Math.min(state.progressIndex, total);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  elements.progressArea.style.display = total > 0 ? "block" : "none";
  elements.progressBar.style.width = `${progress}%`;
  elements.progressText.textContent = `${done} / ${total}`;

  if (!total) {
    elements.currentItemHint.textContent = "Next item: none";
    return;
  }

  if (done >= total) {
    elements.currentItemHint.textContent = "Next item: all items processed";
    return;
  }

  elements.currentItemHint.textContent = `Next item: ${state.names[done]}`;
}

function updateActionButtons() {
  const running = Boolean(state.status && ["running", "stopping"].includes(state.status.state));
  const total = state.names.length;
  const done = Math.min(state.progressIndex, total);
  const hasItems = total > 0;
  const hasRemaining = done < total;

  elements.btnStep.disabled = running || !hasRemaining;
  elements.btnConfirmFinal.disabled = running || !hasItems || done === 0;
  elements.btnStart.disabled = running || !hasRemaining;
  elements.btnResetProgress.disabled = running || !hasItems;
  elements.btnStop.style.display = running ? "block" : "none";
}

function showStatus(kind, message) {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`;
  elements.status.style.display = "block";
}

function hideStatus() {
  elements.status.style.display = "none";
  elements.status.textContent = "";
}

async function processNextItem() {
  try {
    if (!state.names.length) {
      throw new Error("Load a file before processing.");
    }

    if (state.progressIndex >= state.names.length) {
      throw new Error("All names are already processed.");
    }

    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("Could not find the active browser tab.");
    }

    const settings = collectSettings();
    if (!isSupportedUrl(tab.url, settings)) {
      throw new Error("Open a supported brand-exemptions page in the active tab (or a localhost / file:// page when test mode is enabled).");
    }

    await saveSettings();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    const name = state.names[state.progressIndex];
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "brandAutomator:step",
      payload: {
        name,
        settings,
      },
    });

    if (!response?.ok) {
      throw new Error(response?.error || `Failed to process "${name}".`);
    }

    const nextIndex = state.progressIndex + 1;
    await saveProgressIndex(nextIndex);
    showStatus(
      "success",
      nextIndex >= state.names.length
        ? `Processed "${name}". All items are done. Use Click Final Confirm if needed.`
        : `Processed "${name}".`,
    );
  } catch (error) {
    showStatus("error", error.message || "Failed to process the current item.");
  }
}

async function clickFinalConfirm() {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("Could not find the active browser tab.");
    }

    const settings = collectSettings();
    if (!isSupportedUrl(tab.url, settings)) {
      throw new Error("Open a supported brand-exemptions page in the active tab (or a localhost / file:// page when test mode is enabled).");
    }

    await saveSettings();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "brandAutomator:confirm",
      payload: {
        settings,
      },
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Could not click the final confirm button.");
    }

    showStatus("success", "Clicked the final confirm button.");
  } catch (error) {
    const message = String(error?.message || error || "");
    if (isChannelCloseError(message)) {
      showStatus("warn", "Confirm click likely succeeded and the page started reloading.");
      return;
    }
    showStatus("error", error.message || "Failed to click the final confirm button.");
  }
}

async function startAutomation() {
  try {
    if (!state.names.length) {
      throw new Error("Load a file before starting.");
    }

    if (state.progressIndex >= state.names.length) {
      throw new Error("All names are already processed.");
    }

    if (state.names.length - state.progressIndex > 500) {
      throw new Error("This run has more than 500 remaining rows. Split it into smaller batches first.");
    }

    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("Could not find the active browser tab.");
    }

    const settings = collectSettings();
    if (!isSupportedUrl(tab.url, settings)) {
      throw new Error("Open a supported brand-exemptions page in the active tab (or a localhost / file:// page when test mode is enabled).");
    }

    await saveSettings();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "brandAutomator:start",
      payload: {
        names: state.names.slice(state.progressIndex),
        settings,
        startIndex: state.progressIndex,
      },
    });

    if (!response?.ok) {
      throw new Error(response?.error || "The page did not accept the automation request.");
    }

    showStatus("info", "Full automation started from the current progress position.");
  } catch (error) {
    showStatus("error", error.message || "Automation failed to start.");
  }
}

async function resetProgress() {
  await saveProgressIndex(0);
  await chrome.storage.local.remove([STORAGE_KEYS.status, STORAGE_KEYS.unmatched]);
  state.status = null;
  state.unmatched = [];
  renderUnmatched();
  updateActionButtons();
  showStatus("info", "Progress reset to the first item.");
}

async function stopAutomation() {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("Could not find the active browser tab.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    await chrome.tabs.sendMessage(tab.id, { type: "brandAutomator:stop" });
    showStatus("warn", "Stop requested. Waiting for the current step to finish.");
  } catch (error) {
    showStatus("error", error.message || "Failed to send the stop request.");
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function saveProgressIndex(index) {
  state.progressIndex = clampNumber(Number(index), 0, 100000, 0);
  await chrome.storage.local.set({
    [STORAGE_KEYS.progress]: {
      currentIndex: state.progressIndex,
    },
  });
  renderProgress();
  updateActionButtons();
}

function isSupportedUrl(url, settings) {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && /\/marketplace\/seller_brand_exemptions\//i.test(parsed.pathname)) {
      return true;
    }
  } catch (error) {
    // Ignore parse errors and continue to test-page fallback.
  }

  if (settings?.allowTestPages) {
    return (
      /^file:\/\//i.test(url) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)
    );
  }

  return false;
}

function isChannelCloseError(message) {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("message channel closed before a response was received") ||
    lower.includes("the message port closed before a response was received")
  );
}

async function parseSpreadsheetFile(file, settings) {
  const fileName = file.name.toLowerCase();
  let values;

  if (fileName.endsWith(".xlsx")) {
    values = await parseXlsxColumnA(await file.arrayBuffer());
  } else if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    values = parseDelimitedColumnA(await file.text());
  } else if (fileName.endsWith(".xls")) {
    throw new Error("Old .xls files are not supported here. Re-save the file as .xlsx or .csv first.");
  } else {
    throw new Error("Unsupported file type. Use .xlsx, .csv, or .txt.");
  }

  const cleaned = values.map(normalizeCellValue).filter(Boolean);
  return settings.skipFirstRow ? cleaned.slice(1) : cleaned;
}

function normalizeCellValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseDelimitedColumnA(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const values = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    let firstCell = "";
    if (line.startsWith("\"")) {
      let index = 1;
      while (index < line.length) {
        if (line[index] === "\"" && line[index + 1] === "\"") {
          firstCell += "\"";
          index += 2;
          continue;
        }
        if (line[index] === "\"") {
          break;
        }
        firstCell += line[index];
        index += 1;
      }
    } else {
      const delimiterIndex = findDelimiterIndex(line);
      firstCell = delimiterIndex === -1 ? line : line.slice(0, delimiterIndex);
    }

    values.push(firstCell);
  }

  return values;
}

function findDelimiterIndex(line) {
  const indices = [line.indexOf(","), line.indexOf(";"), line.indexOf("\t")].filter((value) => value >= 0);
  return indices.length ? Math.min(...indices) : -1;
}

async function parseXlsxColumnA(arrayBuffer) {
  const zip = parseZipArchive(arrayBuffer);
  const workbookXml = await readZipText(zip, "xl/workbook.xml");
  const workbookRelsXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");
  const sharedStringsXml = await readZipText(zip, "xl/sharedStrings.xml", true);

  const sheetPath = resolveFirstSheetPath(workbookXml, workbookRelsXml);
  const sheetXml = await readZipText(zip, sheetPath);
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];

  return extractColumnAValues(sheetXml, sharedStrings);
}

function parseZipArchive(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("The .xlsx file could not be read. The ZIP directory is invalid.");
    }

    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileNameBytes = new Uint8Array(arrayBuffer, offset + 46, fileNameLength);
    const fileName = decodeZipText(fileNameBytes, flags);

    entries.set(fileName, {
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return { arrayBuffer, view, entries };
}

function findEndOfCentralDirectory(view) {
  const minimumOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("The .xlsx file could not be read. Missing ZIP footer.");
}

function decodeZipText(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function readZipText(zip, fileName, optional = false) {
  const entry = zip.entries.get(fileName);
  if (!entry) {
    if (optional) {
      return "";
    }
    throw new Error(`The spreadsheet is missing ${fileName}.`);
  }

  const { view, arrayBuffer } = zip;
  const headerOffset = entry.localHeaderOffset;
  if (view.getUint32(headerOffset, true) !== 0x04034b50) {
    throw new Error(`The spreadsheet entry ${fileName} has an invalid ZIP header.`);
  }

  const fileNameLength = view.getUint16(headerOffset + 26, true);
  const extraFieldLength = view.getUint16(headerOffset + 28, true);
  const dataStart = headerOffset + 30 + fileNameLength + extraFieldLength;
  const compressed = new Uint8Array(arrayBuffer.slice(dataStart, dataStart + entry.compressedSize));

  let output;
  if (entry.compressionMethod === 0) {
    output = compressed;
  } else if (entry.compressionMethod === 8) {
    output = await inflateRaw(compressed);
  } else {
    throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} in ${fileName}.`);
  }

  return new TextDecoder("utf-8").decode(output);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This Chrome version cannot unpack .xlsx files here. Save the file as CSV instead.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
}

function parseXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) {
    throw new Error("The spreadsheet XML is invalid.");
  }
  return xml;
}

function resolveFirstSheetPath(workbookXmlText, relsXmlText) {
  const workbookXml = parseXml(workbookXmlText);
  const relsXml = parseXml(relsXmlText);
  const sheet = workbookXml.getElementsByTagName("sheet")[0];

  if (!sheet) {
    throw new Error("No worksheet was found in the uploaded spreadsheet.");
  }

  const relationId =
    sheet.getAttribute("r:id") ||
    sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");

  if (!relationId) {
    throw new Error("The first worksheet is missing its relation identifier.");
  }

  const relation = Array.from(relsXml.getElementsByTagName("Relationship")).find(
    (item) => item.getAttribute("Id") === relationId,
  );
  const target = relation?.getAttribute("Target");

  if (!target) {
    throw new Error("Could not resolve the first worksheet path.");
  }

  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\/+/, "")}`;
}

function parseSharedStrings(sharedStringsXmlText) {
  const xml = parseXml(sharedStringsXmlText);
  return Array.from(xml.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t"))
      .map((node) => node.textContent || "")
      .join(""),
  );
}

function extractColumnAValues(sheetXmlText, sharedStrings) {
  const xml = parseXml(sheetXmlText);
  const cells = Array.from(xml.getElementsByTagName("c"));
  const values = [];

  for (const cell of cells) {
    const reference = cell.getAttribute("r") || "";
    if (!/^A\d+$/i.test(reference)) {
      continue;
    }

    const type = cell.getAttribute("t") || "";
    let value = "";

    if (type === "inlineStr") {
      value = Array.from(cell.getElementsByTagName("t"))
        .map((node) => node.textContent || "")
        .join("");
    } else {
      const raw = cell.getElementsByTagName("v")[0]?.textContent || "";
      value = type === "s" ? sharedStrings[Number(raw)] || "" : raw;
    }

    values.push(value);
  }

  return values;
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
