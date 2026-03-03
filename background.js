const ZOTERO_LOCAL = "http://localhost:23119/api";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let itemsCache = null;
let cacheTimestamp = 0;

async function fetchAllItems() {
  const items = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const url = `${ZOTERO_LOCAL}/users/0/items?format=json&itemType=-attachment%20-note&limit=${limit}&start=${start}&sort=dateModified&direction=desc`;
    const resp = await fetch(url, {
      headers: { "Zotero-Allowed-Request": "1" },
    });

    if (!resp.ok) {
      if (resp.status === 0 || resp.status >= 500) {
        throw new Error("Cannot connect to Zotero. Make sure Zotero is running on this computer.");
      }
      throw new Error(`Zotero API error: ${resp.status} ${resp.statusText}`);
    }

    const batch = await resp.json();
    if (batch.length === 0) break;

    items.push(...batch);
    start += limit;

    const totalResults = parseInt(resp.headers.get("Total-Results"), 10);
    if (isNaN(totalResults) || start >= totalResults) break;
  }

  return items;
}

function extractPdfUrl(item) {
  const data = item.data;

  // Check the URL field directly
  if (data.url) {
    // Convert arxiv abstract URLs to PDF URLs
    const arxivMatch = data.url.match(/arxiv\.org\/abs\/(.+)/);
    if (arxivMatch) {
      return `https://arxiv.org/pdf/${arxivMatch[1]}.pdf`;
    }
    if (data.url.endsWith(".pdf")) {
      return data.url;
    }
  }

  // Try DOI
  if (data.DOI) {
    return `https://doi.org/${data.DOI}`;
  }

  // Fallback to URL if present
  if (data.url) {
    return data.url;
  }

  return null;
}

function processItems(rawItems) {
  return rawItems
    .map((item) => {
      const data = item.data;
      const creators = (data.creators || [])
        .map((c) => c.lastName || c.name || "")
        .filter(Boolean);
      const year = data.date ? data.date.match(/\d{4}/)?.[0] || "" : "";
      const pdfUrl = extractPdfUrl(item);

      return {
        key: data.key,
        title: data.title || "Untitled",
        authors: creators.join(", "),
        year,
        pdfUrl,
      };
    })
    .filter((item) => item.pdfUrl);
}

async function getItems(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && itemsCache && now - cacheTimestamp < CACHE_TTL) {
    return itemsCache;
  }

  const rawItems = await fetchAllItems();
  itemsCache = processItems(rawItems);
  cacheTimestamp = now;
  return itemsCache;
}

function searchItems(items, query) {
  const q = query.toLowerCase().trim();
  if (!q) return items.slice(0, 10);

  const terms = q.split(/\s+/);

  const scored = items
    .map((item) => {
      const haystack = `${item.title} ${item.authors} ${item.year}`.toLowerCase();
      const allMatch = terms.every((t) => haystack.includes(t));
      if (!allMatch) return null;

      let score = 0;
      const titleLower = item.title.toLowerCase();
      if (titleLower.startsWith(q)) score += 100;
      if (titleLower.includes(q)) score += 50;
      terms.forEach((t) => {
        if (titleLower.includes(t)) score += 10;
      });

      return { ...item, score };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "search") {
    getItems()
      .then((items) => {
        const results = searchItems(items, message.query);
        sendResponse({ results });
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });
    return true;
  }

  if (message.type === "refreshCache") {
    getItems(true)
      .then((items) => sendResponse({ success: true, count: items.length }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});
