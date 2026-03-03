const refreshBtn = document.getElementById("refresh");
const statusEl = document.getElementById("status");

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type;
}

// Check connection on popup open
chrome.runtime.sendMessage({ type: "refreshCache" }, (resp) => {
  if (resp?.error) {
    showStatus(resp.error, "error");
  } else {
    showStatus(`Connected — ${resp.count} papers loaded`, "success");
  }
});

refreshBtn.addEventListener("click", () => {
  showStatus("Refreshing...", "info");
  chrome.runtime.sendMessage({ type: "refreshCache" }, (resp) => {
    if (resp?.error) {
      showStatus(resp.error, "error");
    } else {
      showStatus(`Refreshed — ${resp.count} papers loaded`, "success");
    }
  });
});
