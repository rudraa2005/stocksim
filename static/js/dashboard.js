document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const uid = localStorage.getItem("uid");
  const nameFromStorage = localStorage.getItem("name") || "";

  // Cached DOM nodes (ensure these IDs exist in your HTML)
  const loader = document.getElementById("loader");
  const mainContent = document.getElementById("main-content");
  const balanceElem = document.getElementById("balance");
  const profitElem = document.getElementById("p");
  const lossElem = document.getElementById("l");
  const usernameSpan = document.getElementById("username-span");
  const watchlistContainer = document.getElementById("stock_info");
  const watchlistError = document.getElementById("watchlist-error");

  const showLoader = () => { if (loader) loader.style.display = "flex"; if (mainContent) mainContent.style.display = "none"; };
  const hideLoader = () => { if (loader) loader.style.display = "none"; if (mainContent) mainContent.style.display = "block"; };

  // If auth missing, redirect to login early
  if (!token || !uid) {
    alert("Session expired. Please log in.");
    window.location.href = "/auth/login";
    return;
  }

  // Helper: fetch and ensure JSON response, attach Authorization header automatically
  async function fetchJson(url, opts = {}) {
    const headers = Object.assign({}, opts.headers || {}, { Authorization: `Bearer ${token}` });
    const response = await fetch(url, Object.assign({}, opts, { headers }));
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      // capture body safely for debugging
      let body = "";
      try { body = await response.text(); } catch (e) { body = String(e); }
      const err = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      err.body = body;
      throw err;
    }

    if (!contentType.includes("application/json")) {
      const text = await response.text();
      const err = new Error("Non-JSON response");
      err.status = response.status;
      err.body = text;
      throw err;
    }

    return response.json();
  }

  // Optional: verify the dashboard page is reachable (no body required)
  fetch("/dashboard", { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (!res.ok) throw new Error("Dashboard page fetch failed");
      console.log("Protected data fetched successfully");
    })
    .catch((err) => console.error("Error fetching protected data:", err));

  // Load and render balance (safe guards for undefined values)
  (async () => {
    try {
      const data = await fetchJson(`/dashboard/balance?uid=${encodeURIComponent(uid)}`);
      const balance = (typeof data.balance === "number") ? data.balance : 0;
      const profit = (typeof data.profit === "number") ? data.profit : 0;
      const loss = (typeof data.loss === "number") ? data.loss : 0;
      const username = data.name || nameFromStorage;

      if (balanceElem) balanceElem.innerText = `₹${Number(balance).toFixed(2)}`;
      if (profitElem) profitElem.innerText = `₹${Number(profit).toFixed(2)}`;
      if (lossElem) lossElem.innerText = `₹${Number(loss).toFixed(2)}`;
      if (usernameSpan && username) usernameSpan.innerText = String(username).toUpperCase();
    } catch (err) {
      console.error("Error fetching balance:", err.status || err.message, err.body || "");
      if (balanceElem) balanceElem.innerText = "₹0.00";
      if (usernameSpan && nameFromStorage) usernameSpan.innerText = nameFromStorage.toUpperCase();
    }
  })();

  // Load and render watchlist (supports array or { fallback: [...] } response)
  (async () => {
    showLoader();
    try {
      const data = await fetchJson("/dashboard/watchlist");
      let items = [];

      if (Array.isArray(data)) {
        items = data;
      } else if (data && Array.isArray(data.fallback)) {
        items = data.fallback;
      } else {
        throw new Error("Unexpected watchlist shape");
      }

      if (watchlistContainer) {
        watchlistContainer.innerHTML = "";
        items.forEach((stock) => {
          const name = stock.name || stock.symbol || "Unknown";
          const symbol = stock.symbol || "";
          const price = (typeof stock.price === "number") ? `₹${Number(stock.price).toFixed(2)}` : (stock.price || "—");
          const p = document.createElement("p");
          p.textContent = `${name} ${symbol ? `(${symbol})` : ""} - ${price}`;
          watchlistContainer.appendChild(p);
        });
      }
    } catch (err) {
      console.error("Error fetching watchlist:", err.status || err.message, err.body || "");
      if (watchlistError) watchlistError.innerText = "Could not load watchlist.";
      // optionally show a small static fallback if container exists
      if (watchlistContainer && watchlistContainer.children.length === 0) {
        const fallback = ["AAPL", "MSFT", "AMZN", "GOOGL", "TSLA"];
        fallback.forEach((s) => {
          const p = document.createElement("p");
          p.textContent = s;
          watchlistContainer.appendChild(p);
        });
      }
    } finally {
      hideLoader();
    }
  })();
});
