document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const uid = localStorage.getItem("uid");
  const nameFromStorage = localStorage.getItem("name") || "";

  // Cached DOM nodes
  const loader = document.getElementById("loader");
  const mainContent = document.getElementById("main-content");
  const balanceElem = document.getElementById("balance");
  const profitElem = document.getElementById("p");
  const lossElem = document.getElementById("l");
  const usernameSpan = document.getElementById("username-span");
  const watchlistContainer = document.getElementById("stock_info");

  const showLoader = () => { 
    if (loader) loader.style.display = "flex"; 
    if (mainContent) mainContent.style.display = "none"; 
  };
  
  const hideLoader = () => { 
    if (loader) loader.style.display = "none"; 
    if (mainContent) mainContent.style.display = "block"; 
  };

  // If auth missing, redirect to login early
  if (!token || !uid) {
    alert("Session expired. Please log in.");
    window.location.href = "/auth/login";
    return;
  }

  // Helper: fetch and ensure JSON response, attach Authorization header automatically
  async function fetchJson(url, opts = {}) {
    const headers = Object.assign({}, opts.headers || {}, { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    });
    const response = await fetch(url, Object.assign({}, opts, { headers }));
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
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

  // Optional: verify the dashboard page is reachable
  fetch("/dashboard", { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (!res.ok) throw new Error("Dashboard page fetch failed");
      console.log("Protected data fetched successfully");
    })
    .catch((err) => console.error("Error fetching protected data:", err));

  // Load and render balance
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

  // Store watchlist data for live updates
  let watchlistStocks = [];
  let priceUpdateInterval = null;

  // Format price with proper styling
  function formatPrice(price) {
    if (price === null || price === undefined) return "—";
    return `₹${Number(price).toFixed(2)}`;
  }

  // Format change percentage
  function formatChange(change, changePercent) {
    if (change === null || change === undefined) return "";
    const sign = change >= 0 ? "+" : "";
    const percentSign = changePercent >= 0 ? "+" : "";
    return {
      value: `${sign}₹${Math.abs(change).toFixed(2)}`,
      percent: `${percentSign}${changePercent.toFixed(2)}%`,
      isPositive: change >= 0
    };
  }

  // Create stock card element
  function createStockCard(stock) {
    const card = document.createElement("div");
    card.className = "stock-card";
    card.dataset.symbol = stock.symbol;

    const change = formatChange(stock.change, stock.changePercent);
    const priceClass = change.isPositive ? "positive" : "negative";
    const priceDisplay = stock.price !== null && stock.price !== undefined 
      ? formatPrice(stock.price) 
      : '<span class="price-loading">Loading...</span>';

    card.innerHTML = `
      <div class="stock-name">${stock.name || stock.symbol}</div>
      <div class="stock-symbol">${stock.symbol}</div>
      <div class="stock-price-container">
        <span class="stock-price ${stock.price !== null && stock.price !== undefined ? (change.isPositive ? '' : 'negative') : ''}">${priceDisplay}</span>
        ${stock.price !== null && stock.price !== undefined && stock.change !== null ? `
          <span class="price-change ${priceClass}">
            ${change.value} (${change.percent})
          </span>
        ` : ''}
      </div>
      <div class="live-indicator">
        <span class="live-dot"></span>
        <span>Live</span>
      </div>
    `;

    return card;
  }

  // Update stock card with new price data
  function updateStockCard(card, priceData) {
    const change = formatChange(priceData.change, priceData.changePercent);
    const priceClass = change.isPositive ? "positive" : "negative";
    const priceDisplay = priceData.price !== null && priceData.price !== undefined 
      ? formatPrice(priceData.price) 
      : '<span class="price-loading">Loading...</span>';

    const priceElement = card.querySelector(".stock-price");
    const changeElement = card.querySelector(".price-change");
    const priceContainer = card.querySelector(".stock-price-container");

    if (priceElement) {
      // Add updating animation
      priceElement.classList.add("updating");
      
      // Update price after a brief delay for smooth transition
      setTimeout(() => {
        priceElement.innerHTML = priceDisplay;
        priceElement.className = `stock-price ${priceData.price !== null && priceData.price !== undefined ? (change.isPositive ? '' : 'negative') : ''}`;
        
        // Remove updating class after animation
        setTimeout(() => {
          priceElement.classList.remove("updating");
        }, 500);
      }, 50);
    }

    if (changeElement && priceData.price !== null && priceData.price !== undefined && priceData.change !== null) {
      changeElement.innerHTML = `${change.value} (${change.percent})`;
      changeElement.className = `price-change ${priceClass}`;
    } else if (priceData.price !== null && priceData.price !== undefined && priceData.change !== null) {
      // Create change element if it doesn't exist
      const newChangeElement = document.createElement("span");
      newChangeElement.className = `price-change ${priceClass}`;
      newChangeElement.innerHTML = `${change.value} (${change.percent})`;
      if (priceContainer) {
        priceContainer.appendChild(newChangeElement);
      }
    }
  }

  // Fetch and update live prices
  async function updateLivePrices() {
    if (watchlistStocks.length === 0) return;

    try {
      const symbols = watchlistStocks.map(s => s.symbol);
      const priceData = await fetchJson("/dashboard/live-prices", {
        method: "POST",
        body: JSON.stringify({ symbols })
      });

      // Update each stock card
      priceData.forEach((priceInfo) => {
        const card = watchlistContainer.querySelector(`[data-symbol="${priceInfo.symbol}"]`);
        if (card) {
          // Update the stock data
          const stockIndex = watchlistStocks.findIndex(s => s.symbol === priceInfo.symbol);
          if (stockIndex !== -1) {
            watchlistStocks[stockIndex].price = priceInfo.price;
            watchlistStocks[stockIndex].change = priceInfo.change;
            watchlistStocks[stockIndex].changePercent = priceInfo.changePercent;
          }
          updateStockCard(card, priceInfo);
        }
      });
    } catch (err) {
      console.error("Error updating live prices:", err.status || err.message, err.body || "");
    }
  }

  // Load and render watchlist
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

      watchlistStocks = items;

      if (watchlistContainer) {
        watchlistContainer.innerHTML = "";
        items.forEach((stock) => {
          const card = createStockCard(stock);
          watchlistContainer.appendChild(card);
        });

        // Start live price updates every 10 seconds
        if (priceUpdateInterval) {
          clearInterval(priceUpdateInterval);
        }
        priceUpdateInterval = setInterval(updateLivePrices, 10000);
        
        // Initial live price update after 2 seconds
        setTimeout(updateLivePrices, 2000);
      }
    } catch (err) {
      console.error("Error fetching watchlist:", err.status || err.message, err.body || "");
      if (watchlistContainer && watchlistContainer.children.length === 0) {
        const fallback = ["AAPL", "MSFT", "AMZN", "GOOGL", "TSLA"];
        fallback.forEach((s) => {
          const card = createStockCard({
            name: s,
            symbol: s,
            price: null,
            change: null,
            changePercent: null
          });
          watchlistContainer.appendChild(card);
        });
      }
    } finally {
      hideLoader();
    }
  })();

  // Cleanup interval on page unload
  window.addEventListener("beforeunload", () => {
    if (priceUpdateInterval) {
      clearInterval(priceUpdateInterval);
    }
  });
});
