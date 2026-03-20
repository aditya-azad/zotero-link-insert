(() => {
  const TRIGGER = "[@";
  let dropdown = null;
  let activeInput = null;
  let selectedIndex = 0;
  let currentResults = [];
  let debounceTimer = null;

  function createDropdown() {
    if (dropdown) return dropdown;
    dropdown = document.createElement("div");
    dropdown.className = "zotero-link-dropdown";
    dropdown.style.display = "none";
    document.body.appendChild(dropdown);
    return dropdown;
  }

  function hideDropdown() {
    if (dropdown) {
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
    }
    currentResults = [];
    selectedIndex = 0;
  }

  function positionDropdown(input) {
    const rect = input.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const dropdownHeight = dropdown.offsetHeight || 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    dropdown.style.left = `${rect.left + scrollX}px`;
    dropdown.style.width = `${Math.max(rect.width, 350)}px`;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      dropdown.style.top = `${rect.top + scrollY - dropdownHeight - 4}px`;
    } else {
      dropdown.style.top = `${rect.bottom + scrollY + 4}px`;
    }
  }

  function renderResults(results) {
    createDropdown();
    dropdown.innerHTML = "";
    currentResults = results;
    selectedIndex = 0;

    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.className = "zotero-link-item zotero-link-empty";
      empty.textContent = "No matching papers found";
      dropdown.appendChild(empty);
      dropdown.style.display = "block";
      return;
    }

    results.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "zotero-link-item" + (i === 0 ? " zotero-link-selected" : "");

      const title = document.createElement("div");
      title.className = "zotero-link-title";
      title.textContent = item.title;

      const meta = document.createElement("div");
      meta.className = "zotero-link-meta";
      meta.textContent = [item.authors, item.year].filter(Boolean).join(" · ");

      el.appendChild(title);
      el.appendChild(meta);

      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        insertResult(item);
      });

      el.addEventListener("mouseenter", () => {
        selectedIndex = i;
        updateSelection();
      });

      dropdown.appendChild(el);
    });

    dropdown.style.display = "block";
  }

  function updateSelection() {
    const items = dropdown.querySelectorAll(".zotero-link-item:not(.zotero-link-empty)");
    items.forEach((el, i) => {
      el.classList.toggle("zotero-link-selected", i === selectedIndex);
    });
  }

  function getTriggerInfo(input) {
    if (input.isContentEditable) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return null;

      const range = sel.getRangeAt(0);
      const container = range.startContainer;
      if (container.nodeType !== Node.TEXT_NODE) return null;

      const text = container.textContent;
      const cursorPos = range.startOffset;
      const beforeCursor = text.slice(0, cursorPos);

      const triggerIdx = beforeCursor.lastIndexOf(TRIGGER);
      if (triggerIdx === -1) return null;

      const query = beforeCursor.slice(triggerIdx + TRIGGER.length);
      // Don't trigger if there's a closing bracket (already completed)
      if (query.includes("]")) return null;

      return {
        query,
        triggerStart: triggerIdx,
        cursorPos,
        textNode: container,
        type: "contenteditable",
      };
    }

    const cursorPos = input.selectionStart;
    const text = input.value;
    const beforeCursor = text.slice(0, cursorPos);

    const triggerIdx = beforeCursor.lastIndexOf(TRIGGER);
    if (triggerIdx === -1) return null;

    const query = beforeCursor.slice(triggerIdx + TRIGGER.length);
    if (query.includes("]")) return null;

    return {
      query,
      triggerStart: triggerIdx,
      cursorPos,
      type: "input",
    };
  }

  function insertResult(item) {
    const info = getTriggerInfo(activeInput);
    if (!info) {
      hideDropdown();
      return;
    }

    const url = item.pdfUrl;

    if (info.type === "contenteditable") {
      const textNode = info.textNode;
      const text = textNode.textContent;
      const before = text.slice(0, info.triggerStart);
      const after = text.slice(info.cursorPos);
      textNode.textContent = before + url + after;

      // Restore cursor position after the inserted URL
      const sel = window.getSelection();
      const range = document.createRange();
      const newPos = info.triggerStart + url.length;
      range.setStart(textNode, newPos);
      range.setEnd(textNode, newPos);
      sel.removeAllRanges();
      sel.addRange(range);

      // Fire input event for frameworks to pick up the change
      activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      const text = activeInput.value;
      const before = text.slice(0, info.triggerStart);
      const after = text.slice(info.cursorPos);
      activeInput.value = before + url + after;

      const newPos = info.triggerStart + url.length;
      activeInput.selectionStart = newPos;
      activeInput.selectionEnd = newPos;

      activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    hideDropdown();
  }

  function handleInput(e) {
    const input = e.target;
    if (
      !input.matches('input[type="text"], input[type="url"], input[type="search"], input:not([type]), textarea') &&
      !input.isContentEditable
    ) {
      return;
    }

    activeInput = input;
    const info = getTriggerInfo(input);

    if (!info) {
      hideDropdown();
      return;
    }

    createDropdown();
    positionDropdown(input);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ type: "search", query: info.query }, (resp) => {
        if (chrome.runtime.lastError) {
          console.error("Zotero Link Insert:", chrome.runtime.lastError.message);
          return;
        }
        if (resp.error) {
          const errEl = document.createElement("div");
          errEl.className = "zotero-link-item zotero-link-empty";
          errEl.textContent = resp.error;
          dropdown.innerHTML = "";
          dropdown.appendChild(errEl);
          dropdown.style.display = "block";
          return;
        }
        renderResults(resp.results);
      });
    }, 150);
  }

  function handleKeydown(e) {
    if (!dropdown || dropdown.style.display === "none" || currentResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % currentResults.length;
      updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
      updateSelection();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertResult(currentResults[selectedIndex]);
    } else if (e.key === "Escape") {
      hideDropdown();
    }
  }

  function handleBlur() {
    // Small delay to allow mousedown on dropdown items to fire
    setTimeout(hideDropdown, 200);
  }

  document.addEventListener("input", handleInput, true);
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("focusout", handleBlur, true);
})();
