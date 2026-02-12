// ===================== TRADE PAGE JS =====================
// Single-page trade: sidebar stock list + inline chart & buy/sell

const uid = localStorage.getItem("uid");
const token = localStorage.getItem("token");

// ---- State ----
let allStocks = [];
let filteredStocks = [];
let selectedStock = null;
let currentPrice = null;
let stockChart = null;
let currentPeriod = "1d";
let userBalance = 0;
let pollTimer = null;

// ---- DOM Refs ----
const stockListEl = document.getElementById("stock-list");
const stockCountEl = document.getElementById("stock-count");
const searchInput = document.getElementById("stock-search");
const emptyState = document.getElementById("empty-state");
const stockDetail = document.getElementById("stock-detail");
const detailSymbol = document.getElementById("detail-symbol");
const detailName = document.getElementById("detail-name");
const detailPrice = document.getElementById("detail-price");
const detailChange = document.getElementById("detail-change");
const chartLoader = document.getElementById("chart-loader");
const tradeBalance = document.getElementById("trade-balance");
const quantityInput = document.getElementById("trade-quantity");
const estimatedTotal = document.getElementById("estimated-total");
const btnBuy = document.getElementById("btn-buy");
const btnSell = document.getElementById("btn-sell");
const toastContainer = document.getElementById("toast-container");

// ---- Auth check ----
if (!token || !uid) {
  alert("Session expired. Please log in.");
  window.location.href = "/auth/login";
}

// ---- Toast Notification ----
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---- Fetch Balance ----
async function fetchBalance() {
  try {
    const res = await fetch(`/dashboard/balance?uid=${uid}`);
    const data = await res.json();
    userBalance = data.balance || 0;
    if (tradeBalance) tradeBalance.textContent = `₹${userBalance.toFixed(2)}`;
  } catch (e) {
    console.error("Error fetching balance:", e);
  }
}

// ---- Load Stocks (Progressive Cache) ----
async function loadStocks() {
  try {
    const res = await fetch("/trade/stocks");
    const data = await res.json();
    const stocks = data.stocks || [];

    allStocks = stocks;
    filteredStocks = stocks;
    renderStockList(filteredStocks);

    // If not complete, poll for full list
    if (!data.complete) {
      stockCountEl.textContent = `${stocks.length} stocks · loading more...`;
      setTimeout(pollForFullList, 5000);
    } else {
      stockCountEl.textContent = `${stocks.length} stocks`;
    }
  } catch (e) {
    console.error("Error loading stocks:", e);
    stockListEl.innerHTML = `<div class="stock-list-loader"><span>Failed to load stocks</span></div>`;
  }
}

async function pollForFullList() {
  try {
    const res = await fetch("/trade/stocks");
    const data = await res.json();
    const stocks = data.stocks || [];

    if (stocks.length > allStocks.length) {
      allStocks = stocks;
      // Re-apply search filter
      const query = searchInput.value.trim().toLowerCase();
      if (query) {
        filteredStocks = allStocks.filter(s =>
          s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
        );
      } else {
        filteredStocks = allStocks;
      }
      renderStockList(filteredStocks);
    }

    if (data.complete) {
      stockCountEl.textContent = `${stocks.length} stocks`;
    } else {
      stockCountEl.textContent = `${stocks.length} stocks · loading more...`;
      setTimeout(pollForFullList, 5000);
    }
  } catch (e) {
    console.error("Error polling stocks:", e);
  }
}

// ---- Render Stock List ----
function renderStockList(stocks) {
  stockListEl.innerHTML = "";
  stocks.forEach(stock => {
    const item = document.createElement("div");
    item.className = "stock-item";
    if (selectedStock && selectedStock.symbol === stock.symbol) {
      item.classList.add("active");
    }
    item.dataset.symbol = stock.symbol;
    item.innerHTML = `
      <div class="stock-item-left">
        <span class="stock-item-symbol">${stock.symbol}</span>
        <span class="stock-item-name">${stock.name || stock.symbol}</span>
      </div>
      <span class="stock-item-price" id="sidebar-price-${stock.symbol}">—</span>
    `;
    item.addEventListener("click", () => selectStock(stock));
    stockListEl.appendChild(item);
  });
}

// ---- Search/Filter ----
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      filteredStocks = allStocks;
    } else {
      filteredStocks = allStocks.filter(s =>
        s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
      );
    }
    renderStockList(filteredStocks);
  });
}

// ---- Select Stock ----
async function selectStock(stock) {
  selectedStock = stock;
  currentPrice = null;

  // Update sidebar active state
  document.querySelectorAll(".stock-item").forEach(el => {
    el.classList.toggle("active", el.dataset.symbol === stock.symbol);
  });

  // Show detail view, hide empty state
  emptyState.style.display = "none";
  stockDetail.style.display = "block";

  // Set stock info
  detailSymbol.textContent = stock.symbol;
  detailName.textContent = stock.name || stock.symbol;
  detailPrice.textContent = "Loading...";
  detailChange.textContent = "—";
  detailChange.className = "price-change-badge";

  // Reset trading controls
  quantityInput.value = "";
  estimatedTotal.textContent = "₹0.00";

  // Fetch live price
  fetchLivePrice(stock.symbol);

  // Load chart
  loadChart(stock.symbol, currentPeriod);

  // Store selected stock for reference
  localStorage.setItem("selectedStock", JSON.stringify(stock));
}

// ---- Fetch Live Price ----
async function fetchLivePrice(symbol) {
  try {
    const res = await fetch(`/trade/stock-price?symbol=${symbol}`);
    const data = await res.json();

    if (data.error) {
      detailPrice.textContent = "N/A";
      return;
    }

    currentPrice = data.price;
    detailPrice.textContent = `₹${data.price.toFixed(2)}`;

    // Update sidebar price too
    const sidebarPriceEl = document.getElementById(`sidebar-price-${symbol}`);
    if (sidebarPriceEl) {
      sidebarPriceEl.textContent = `₹${data.price.toFixed(2)}`;
      sidebarPriceEl.classList.add("loaded");
    }

    // Update change badge
    if (data.change !== null && data.change !== undefined) {
      const sign = data.change >= 0 ? "+" : "";
      detailChange.textContent = `${sign}₹${Math.abs(data.change).toFixed(2)} (${sign}${data.changePercent.toFixed(2)}%)`;
      detailChange.className = `price-change-badge${data.change < 0 ? " negative" : ""}`;
    }

    // Update current price on selected stock object
    if (selectedStock && selectedStock.symbol === symbol) {
      selectedStock.price = data.price;
    }

    // Update estimated total if quantity is entered
    updateEstimatedTotal();
  } catch (e) {
    console.error("Error fetching price:", e);
    detailPrice.textContent = "Error";
  }
}

// ---- Load Chart ----
async function loadChart(symbol, period) {
  chartLoader.classList.remove("hidden");

  try {
    const res = await fetch(`/api/stock-data?symbol=${symbol}&period=${period}`);
    const data = await res.json();

    if (data.error) {
      chartLoader.innerHTML = `<span style="color: rgba(255,255,255,0.4);">No chart data available</span>`;
      return;
    }

    const ctx = document.getElementById("stockChart");

    if (stockChart) {
      stockChart.destroy();
    }

    // Determine gradient color based on price trend
    const prices = data.prices;
    const isUp = prices.length >= 2 && prices[prices.length - 1] >= prices[0];
    const lineColor = isUp ? "rgba(76, 175, 80, 1)" : "rgba(244, 67, 54, 1)";
    const fillColor = isUp ? "rgba(76, 175, 80, 0.08)" : "rgba(244, 67, 54, 0.08)";

    stockChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [{
          label: `${symbol} Price (₹)`,
          data: prices,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: lineColor,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            titleColor: "rgba(255,255,255,0.7)",
            bodyColor: "#fff",
            bodyFont: { weight: "bold", size: 14 },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (ctx) => `₹${ctx.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "rgba(255,255,255,0.3)",
              font: { size: 10 },
              maxTicksLimit: 10,
            },
            grid: { color: "rgba(255,255,255,0.03)" },
            border: { color: "rgba(255,255,255,0.05)" },
          },
          y: {
            ticks: {
              color: "rgba(255,255,255,0.3)",
              font: { size: 10 },
              callback: (v) => `₹${v.toFixed(0)}`
            },
            grid: { color: "rgba(255,255,255,0.03)" },
            border: { color: "rgba(255,255,255,0.05)" },
          }
        }
      }
    });

    chartLoader.classList.add("hidden");
  } catch (e) {
    console.error("Error loading chart:", e);
    chartLoader.innerHTML = `<span>Failed to load chart</span>`;
  }
}

// ---- Period Selector ----
document.querySelectorAll(".period-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentPeriod = btn.dataset.period;
    if (selectedStock) {
      loadChart(selectedStock.symbol, currentPeriod);
    }
  });
});

// ---- Quantity & Estimated Total ----
function updateEstimatedTotal() {
  const qty = parseFloat(quantityInput.value) || 0;
  const price = currentPrice || 0;
  const total = qty * price;
  estimatedTotal.textContent = `₹${total.toFixed(2)}`;
}

if (quantityInput) {
  quantityInput.addEventListener("input", updateEstimatedTotal);
}

// ---- BUY Handler ----
if (btnBuy) {
  btnBuy.addEventListener("click", async () => {
    if (!selectedStock || !currentPrice) {
      showToast("Please select a stock first", "error");
      return;
    }

    const qty = parseFloat(quantityInput.value);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      showToast("Enter a valid quantity (whole number)", "error");
      return;
    }

    const totalCost = qty * currentPrice;

    // Client-side balance check
    if (totalCost > userBalance) {
      showToast(`Insufficient balance. Need ₹${totalCost.toFixed(2)}, have ₹${userBalance.toFixed(2)}`, "error");
      return;  // CRITICAL: return here to prevent the trade from executing
    }

    // Disable buttons while processing
    btnBuy.disabled = true;
    btnSell.disabled = true;
    btnBuy.innerHTML = `<div class="spinner-small" style="width:16px;height:16px;border-width:2px;"></div> Processing...`;

    try {
      const res = await fetch("/dashboard/updated_balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uid,
          symbol: selectedStock.symbol,
          price: currentPrice.toFixed(2),
          quantity: qty,
          totalCost: totalCost,
          balance: userBalance - totalCost,
        })
      });

      const data = await res.json();

      if (!res.ok) {
        // Server rejected the trade (e.g. insufficient balance on server side)
        showToast(data.error || "Trade failed", "error");
        return;
      }

      // Success
      userBalance = data.balance;
      tradeBalance.textContent = `₹${userBalance.toFixed(2)}`;
      quantityInput.value = "";
      estimatedTotal.textContent = "₹0.00";
      showToast(`Bought ${qty} shares of ${selectedStock.symbol} for ₹${data.totalCost.toFixed(2)}`, "success");
    } catch (e) {
      console.error("Buy error:", e);
      showToast("Failed to execute buy order", "error");
    } finally {
      btnBuy.disabled = false;
      btnSell.disabled = false;
      btnBuy.innerHTML = `<i class="fas fa-arrow-up"></i> Buy`;
    }
  });
}

// ---- SELL Handler ----
if (btnSell) {
  btnSell.addEventListener("click", async () => {
    if (!selectedStock || !currentPrice) {
      showToast("Please select a stock first", "error");
      return;
    }

    const qty = parseFloat(quantityInput.value);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      showToast("Enter a valid quantity (whole number)", "error");
      return;
    }

    // Disable buttons while processing
    btnBuy.disabled = true;
    btnSell.disabled = true;
    btnSell.innerHTML = `<div class="spinner-small" style="width:16px;height:16px;border-width:2px;"></div> Processing...`;

    try {
      // First check holdings
      const tradesRes = await fetch(`/portfolio/trades?uid=${uid}`);
      const trades = await tradesRes.json();

      let ownedQuantity = 0;
      trades.forEach(trade => {
        if (trade.symbol === selectedStock.symbol) {
          if (trade.sell) {
            ownedQuantity -= trade.quantity;
          } else if (trade.buy) {
            ownedQuantity += trade.quantity;
          }
        }
      });

      if (qty > ownedQuantity) {
        showToast(`Not enough shares. You own ${ownedQuantity} of ${selectedStock.symbol}`, "error");
        return;
      }

      const totalValue = qty * currentPrice;
      const newBalance = userBalance + totalValue;

      const res = await fetch("/dashboard/update_sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uid,
          symbol: selectedStock.symbol,
          quantity: qty,
          price: currentPrice.toFixed(2),
          totalValue: totalValue,
          balance: newBalance,
          newQuantity: ownedQuantity - qty,
          timestamp: Date.now()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Sell failed", "error");
        return;
      }

      // Success
      userBalance = data.balance;
      tradeBalance.textContent = `₹${userBalance.toFixed(2)}`;
      quantityInput.value = "";
      estimatedTotal.textContent = "₹0.00";
      showToast(`Sold ${qty} shares of ${selectedStock.symbol} for ₹${data.sellValue.toFixed(2)}`, "success");
    } catch (e) {
      console.error("Sell error:", e);
      showToast("Failed to execute sell order", "error");
    } finally {
      btnBuy.disabled = false;
      btnSell.disabled = false;
      btnSell.innerHTML = `<i class="fas fa-arrow-down"></i> Sell`;
    }
  });
}

// ---- Initialize ----
(async () => {
  await fetchBalance();
  await loadStocks();
})();