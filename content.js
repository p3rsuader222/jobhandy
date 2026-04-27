(() => {
  if (window.__brandAutomatorInjected) {
    return;
  }

  window.__brandAutomatorInjected = true;

  const STATUS_KEY = "brandAutomatorStatus";
  const PROGRESS_KEY = "brandAutomatorProgress";
  const UNMATCHED_KEY = "brandAutomatorUnmatched";
  const MAX_ITEMS_PER_RUN = 500;
  const MAX_CONSECUTIVE_MISSES = 5;
  let activeRun = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "brandAutomator:start") {
      handleStart(message.payload)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }

    if (message?.type === "brandAutomator:step") {
      handleStep(message.payload)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }

    if (message?.type === "brandAutomator:confirm") {
      handleConfirm(message.payload)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }

    if (message?.type === "brandAutomator:stop") {
      if (activeRun) {
        activeRun.stopRequested = true;
        pushStatus({
          state: "stopping",
          total: activeRun.totalItems,
          completed: activeRun.completed,
          currentName: activeRun.currentName || "",
          message: "Stop requested. Waiting for the current page action to finish.",
        });
      }
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  async function handleStart(payload) {
    if (activeRun?.state === "running") {
      return { ok: false, error: "Automation is already running in this tab." };
    }

    const names = Array.isArray(payload?.names) ? payload.names.map(String).filter(Boolean) : [];
    if (!names.length) {
      return { ok: false, error: "No names were provided to the content script." };
    }
    if (names.length > MAX_ITEMS_PER_RUN) {
      return { ok: false, error: `Refusing to run more than ${MAX_ITEMS_PER_RUN} items at once.` };
    }

    const startIndex = clampNumber(Number(payload?.startIndex), 0, 100000, 0);
    activeRun = {
      state: "running",
      stopRequested: false,
      names,
      settings: payload?.settings || {},
      totalItems: names.length,
      completed: 0,
      currentName: "",
      errors: [],
      consecutiveMisses: 0,
      startedUrl: location.href,
      deadlineAt: Date.now() + Math.max(10 * 60 * 1000, names.length * 15000),
      startIndex,
    };

    await pushProgress(startIndex);
    await pushStatus({
      state: "running",
      total: names.length,
      completed: 0,
      currentName: "",
      message: "Automation started.",
      startedAt: Date.now(),
    });

    runAutomation().catch((error) => {
      failAutomation(error);
    });

    return { ok: true };
  }

  async function handleStep(payload) {
    if (activeRun?.state === "running") {
      return { ok: false, error: "Full automation is already running in this tab." };
    }

    const name = String(payload?.name || "").trim();
    if (!name) {
      return { ok: false, error: "No item was provided for the manual step." };
    }

    const result = await processSingleItem(name, payload?.settings || {});
    if (!result.ok) {
      await addUnmatchedName(name);
      return { ok: false, error: result.error };
    }

    await removeUnmatchedName(name);
    return { ok: true };
  }

  async function handleConfirm(payload) {
    if (activeRun?.state === "running") {
      return { ok: false, error: "Stop the full automation before clicking final confirm manually." };
    }

    const settings = payload?.settings || {};
    const confirmButton = resolveConfirmButton(settings.confirmButtonSelector);
    if (!confirmButton) {
      return { ok: false, error: "Could not find the final confirm button. Add its selector in Advanced selectors." };
    }

    clickElement(confirmButton);
    // Return immediately because confirm may trigger navigation and close the message channel.
    return { ok: true };
  }

  async function runAutomation() {
    const run = activeRun;

    for (let index = 0; index < run.names.length; index += 1) {
      assertNotStopped();
      assertStillOnSamePage();
      assertDeadlineNotExceeded();

      const name = run.names[index];
      run.currentName = name;

      await pushStatus({
        state: "running",
        total: run.totalItems,
        completed: run.completed,
        currentName: name,
        message: `Processing ${index + 1} of ${run.totalItems}: ${name}`,
        errors: run.errors.slice(-10),
      });

      const result = await processSingleItem(name, run.settings);
      run.completed += 1;
      await pushProgress(run.startIndex + run.completed);

      if (!result.ok) {
        run.errors.push(result.error);
        run.consecutiveMisses += 1;
        await addUnmatchedName(name);
        await pushStatus({
          state: "running",
          total: run.totalItems,
          completed: run.completed,
          currentName: name,
          message: result.error,
          errors: run.errors.slice(-10),
        });
        if (run.consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
          throw new Error(`Stopped after ${MAX_CONSECUTIVE_MISSES} consecutive misses. Review the page selectors before continuing.`);
        }
        continue;
      }

      run.consecutiveMisses = 0;
      await removeUnmatchedName(name);
      await pushStatus({
        state: "running",
        total: run.totalItems,
        completed: run.completed,
        currentName: name,
        message: `Moved "${name}" to the right-side list.`,
        errors: run.errors.slice(-10),
      });
    }

    if (run.settings.clickConfirm) {
      assertNotStopped();
      assertStillOnSamePage();
      const confirmButton = resolveConfirmButton(run.settings.confirmButtonSelector);
      if (!confirmButton) {
        throw new Error("Could not find the final confirm button. Add its selector in Advanced selectors.");
      }
      clickElement(confirmButton);
      await sleep(clampNumber(Number(run.settings.delay), 150, 5000, 700));
    }

    await finishAutomation();
  }

  async function finishAutomation() {
    const run = activeRun;
    if (!run) {
      return;
    }

    const summary = run.errors.length
      ? `Completed with ${run.errors.length} skipped item${run.errors.length === 1 ? "" : "s"}.`
      : "Completed successfully.";

    await pushStatus({
      state: "completed",
      total: run.totalItems,
      completed: run.completed,
      currentName: "",
      message: summary,
      errors: run.errors.slice(-10),
      finishedAt: Date.now(),
    });

    activeRun = null;
  }

  async function failAutomation(error) {
    const message = error?.name === "StopRequestedError"
      ? "Automation stopped before finishing."
      : error?.message || "Automation failed.";

    if (activeRun) {
      await pushStatus({
        state: error?.name === "StopRequestedError" ? "stopped" : "error",
        total: activeRun.totalItems,
        completed: activeRun.completed,
        currentName: "",
        message,
        errors: activeRun.errors.slice(-10),
        finishedAt: Date.now(),
      });
    } else {
      await pushStatus({
        state: "error",
        total: 0,
        completed: 0,
        currentName: "",
        message,
        finishedAt: Date.now(),
      });
    }

    activeRun = null;
  }

  async function pushStatus(status) {
    await chrome.storage.local.set({ [STATUS_KEY]: status });
  }

  async function pushProgress(currentIndex) {
    await chrome.storage.local.set({ [PROGRESS_KEY]: { currentIndex } });
  }

  async function addUnmatchedName(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return;
    }
    const stored = await chrome.storage.local.get(UNMATCHED_KEY);
    const existing = Array.isArray(stored[UNMATCHED_KEY]) ? stored[UNMATCHED_KEY] : [];
    if (existing.includes(trimmed)) {
      return;
    }
    existing.push(trimmed);
    await chrome.storage.local.set({ [UNMATCHED_KEY]: existing });
  }

  async function removeUnmatchedName(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return;
    }
    const stored = await chrome.storage.local.get(UNMATCHED_KEY);
    const existing = Array.isArray(stored[UNMATCHED_KEY]) ? stored[UNMATCHED_KEY] : [];
    const filtered = existing.filter((entry) => entry !== trimmed);
    if (filtered.length === existing.length) {
      return;
    }
    await chrome.storage.local.set({ [UNMATCHED_KEY]: filtered });
  }

  async function processSingleItem(name, settings) {
    const delay = clampNumber(Number(settings.delay), 150, 5000, 700);
    const startedUrl = location.href;

    const input = resolveInput(settings.inputSelector);
    if (!input) {
      return { ok: false, error: "Could not find the filter input field. Add its selector in Advanced selectors." };
    }

    const addButton = resolveAddButton(settings.addButtonSelector);
    if (!addButton) {
      return { ok: false, error: "Could not find the move-right button. Add its selector in Advanced selectors." };
    }

    setElementValue(input, name);
    await sleep(delay);

    if (location.href !== startedUrl) {
      return { ok: false, error: "The page URL changed during the step. Nothing else was clicked." };
    }

    const listItem = await waitForStepMatch(
      () => resolveListItem(name, settings.listItemSelector),
      Math.max(2000, delay * 6),
      120,
    );

    if (!listItem) {
      return { ok: false, error: `No matching left-list item found for "${name}".` };
    }

    clickElement(listItem);
    await sleep(Math.max(150, Math.round(delay / 2)));

    if (location.href !== startedUrl) {
      return { ok: false, error: "The page URL changed after selecting the item. Automation stopped." };
    }

    clickElement(addButton);
    await sleep(delay);
    return { ok: true };
  }

  function assertNotStopped() {
    if (activeRun?.stopRequested) {
      const error = new Error("Stop requested.");
      error.name = "StopRequestedError";
      throw error;
    }
  }

  function assertStillOnSamePage() {
    if (activeRun && location.href !== activeRun.startedUrl) {
      throw new Error("The page URL changed during the run. Automation stopped to avoid acting on the wrong screen.");
    }
  }

  function assertDeadlineNotExceeded() {
    if (activeRun && Date.now() > activeRun.deadlineAt) {
      throw new Error("The run took too long and was stopped automatically.");
    }
  }

  function resolveInput(selector) {
    if (selector) {
      return findVisibleBySelector(selector);
    }

    return findFirstVisible(
      "input:not([type='hidden']):not([disabled]), textarea:not([disabled])",
      (element) => !element.readOnly,
    );
  }

  function resolveListItem(name, selector) {
    const candidates = selector
      ? findAllVisible(selector)
      : findAllVisible("li, button, [role='option'], [role='treeitem'], [role='menuitem'], [role='row'], div, span, td, label, option");

    const target = normalizeText(name);
    const scored = candidates
      .map((element) => {
        const text = normalizeText(getVisibleText(element));
        if (!text) {
          return null;
        }

        let score = 0;
        if (text === target) {
          score = 3;
        } else if (text.startsWith(target)) {
          score = 2;
        } else if (text.includes(target)) {
          score = 1;
        }

        if (!score) {
          return null;
        }

        return { element, score, textLength: text.length };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score;
        }
        return left.textLength - right.textLength;
      });

    return scored[0]?.element || null;
  }

  function resolveAddButton(selector) {
    if (selector) {
      return findVisibleBySelector(selector);
    }

    return findVisibleButton((text) => {
      const normalized = normalizeText(text);
      return normalized === ">>" || normalized === ">" || normalized.includes("add") || normalized.includes("prideti");
    });
  }

  function resolveConfirmButton(selector) {
    if (selector) {
      return findVisibleBySelector(selector);
    }

    return findVisibleButton((text) => {
      const normalized = normalizeText(text);
      return (
        normalized.includes("atnaujinti") ||
        normalized.includes("save") ||
        normalized.includes("update") ||
        normalized.includes("confirm") ||
        normalized.includes("issaugoti")
      );
    });
  }

  function findVisibleButton(predicate) {
    const candidates = findAllVisible("button, input[type='button'], input[type='submit'], [role='button']");
    return candidates.find((element) => predicate(getButtonText(element))) || null;
  }

  function getButtonText(element) {
    if (element instanceof HTMLInputElement) {
      return element.value || "";
    }
    return getVisibleText(element);
  }

  function setElementValue(element, value) {
    element.focus();

    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function clickElement(element) {
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  }

  async function waitForStepMatch(getter, timeoutMs, pollMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = getter();
      if (value) {
        return value;
      }
      await sleep(pollMs);
    }
    return null;
  }

  function findVisibleBySelector(selector) {
    return findFirstVisible(selector);
  }

  function findFirstVisible(selector, extraFilter = null) {
    return findAllVisible(selector).find((element) => (extraFilter ? extraFilter(element) : true)) || null;
  }

  function findAllVisible(selector) {
    let elements;
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch (error) {
      throw new Error(`Invalid CSS selector: ${selector}`);
    }

    return elements.filter(isVisible);
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function getVisibleText(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function clampNumber(value, min, max, fallback) {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, value));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
