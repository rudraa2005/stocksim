document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const uid = localStorage.getItem("uid");
  const nameFromStorage = localStorage.getItem("name");

  // DOM nodes (cache once)
  const loader = document.getElementById("loader");
  const mainContent = document.getElementById("main-content");
  const balanceElem = document.getElementById("balance");      // ensure HTML has id="balance"
  const profitElem = document.getElementById("p");             // ensure id="p"
  const lossElem = document.getElementById("l");               // ensure id="l"
  const usernameSpan = document.getElementById("username-span");
  const watchlistContainer = document.getElementById("stock_info");
  const watchlistError = document.getElementById("watchlist-error"); // optional element for errors

  // show loader
  if (loader) loader.style.display = "flex";
  if (mainContent) mainContent.style.display = "none";

  if (!token || !uid) {
    alert("Session expired. Please log in.");
    window.location.href = "/auth/login";
    return;
  }

  // small helper to fetch and ensure JSON
  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, Object.assign({ headers: { Authorization: `Bearer ${token}` } }, opts));
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      // get text for debugging
      let body = "";
      try { body = await res.text(); } catch (e) { body = String(e); }
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    if (!ct.includes("application/json")) {
      const text = await res.text();
      const err = new Error("Non-JSON response");
      err.status = res.status;
      err.body = text;
      throw err;
    }
    return res.json();
  }

  // Fetch protected dashboard (optional)
  fetch("/dashboard", { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      // we don't need body; if res is not ok it will be noticed in next lines
      if (!res.ok) throw new Error("Dashboard page fetch failed");
      console.log("Protected data fetched successfully");
    })
    .catch((err) => console.error("Error fetching protected data:", err));

  // Balance
  (async () => {
    try {
      const data = await fetchJson(`/dashboard/balance?uid=${encodeURIComponent(uid)}`);
      // guard fields
      const balance = typeof data.balance === "number" ? data.balance : null;
      const profit = typeof data.profit === "number" ? data.profit : null;
      const loss = typeof data.loss === "number" ? data.loss : null;
      const username = data.name || nameFromStorage || "";

      if (balanceElem) balanceElem.innerText = balance !== null ? `₹${balance.toFixed(2)}` : "₹0.00";
      if (profitElem) profitElem.innerText = profit !== null ? `₹${profit.toFixed(2)}` : "₹0.00";
      if (lossElem) lossElem.innerText = loss !== null ? `₹${loss.toFixed(2)}` : "₹0.00";
      if (usernameSpan && username) usernameSpan.innerText = username.toUpperCase();
    } catch (err) {
      console.error("Error fetching balance:", err.status || err.message, err.body || "");
      if (balanceElem) balanceElem.innerText = "₹0.00";
      if (usernameSpan && nameFromStorage) usernameSpan.innerText = nameFromStorage.toUpperCase();
    }
  })();

  // Watchlist
  (async () => {
    try {
      const data = await fetchJson("/dashboard/watchlist");
      console.log("API response:", data);

      if (!Array.isArray(data)) {
        throw new Error("Expected watchlist array");
      }

      if (watchlistContainer) {
        watchlistContainer.innerHTML = ""; // clear existing
        data.forEach((stock) => {
          const stockElement = document.createElement("p");
          const displayPrice = typeof stock.price === "number" ? `₹${stock.price}` : stock.price || "—";
          stockElement.textContent = `${stock.name} (${stock.symbol}) - ${displayPrice}`;
          watchlistContainer.appendChild(stockElement);
        });
      }
    } catch (err) {
      console.error("Error fetching watchlist:", err.status || err.message, err.body || "");
      if (watchlistError) watchlistError.innerText = "Could not load watchlist.";
    } finally {
      if (loader) loader.style.display = "none";
      if (mainContent) mainContent.style.display = "block";
    }
  })();
});
