const uid = localStorage.getItem("uid");

// Initialize chart
let portfolioChart = null;

// Fetch and render chart data
async function renderChart() {
  try {
    const response = await fetch(`/portfolio/chart-data?uid=${uid}`);
    const chartData = await response.json();

    const ctx = document.getElementById('portfolioChart');
    if (!ctx) return;

    if (portfolioChart) {
      portfolioChart.destroy();
    }

    // Handle empty data
    const labels = chartData.labels || [];
    const buyData = chartData.buyData || [];
    const sellData = chartData.sellData || [];

    if (labels.length === 0) {
      // Show empty state message
      ctx.parentElement.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6); padding: 2rem;">No trading activity yet. Start trading to see your activity chart!</p>';
      return;
    }

    portfolioChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Buy Value (₹)',
            data: buyData,
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Sell Value (₹)',
            data: sellData,
            borderColor: 'rgba(244, 67, 54, 1)',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#fff',
              font: {
                family: 'League Spartan, sans-serif',
                size: 14
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                family: 'League Spartan, sans-serif'
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                family: 'League Spartan, sans-serif'
              },
              callback: (value) => `₹${value.toLocaleString()}`
            }
          }
        }
      }
    });
  } catch (error) {
    console.error("Error loading chart data:", error);
  }
}

// Fetch live prices for stocks
async function fetchLivePrices(symbols) {
  try {
    const response = await fetch("/dashboard/live-prices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ symbols })
    });
    const data = await response.json();
    const priceMap = {};
    data.forEach(item => {
      priceMap[item.symbol] = item.price || 0;
    });
    return priceMap;
  } catch (error) {
    console.error("Error fetching live prices:", error);
    return {};
  }
}

// Main portfolio rendering
fetch(`/portfolio/trades?uid=${uid}`)
  .then((res) => res.json())
  .then(async (data) => {
    const tableBody = document.getElementById("table-body");
    let totalValue = 0;

    // Map symbol to holdings
    const holdings = {};

    // Go through all trades to calculate net quantity and avg buy price
    data.forEach((trade) => {
      const symbol = trade.symbol;
      const quantity = trade.quantity;

      if (!holdings[symbol]) {
        holdings[symbol] = {
          quantity: 0,
          totalCost: 0,
          livePrice: trade.live_price || trade.livePrice || 0,
        };
      }

      if (trade.buy) {
        holdings[symbol].quantity += quantity;
        holdings[symbol].totalCost += trade.buy_price * quantity;
      } else if (trade.sell) {
        holdings[symbol].quantity -= trade.oldQuantity || trade.quantity; // Reduce by amount sold
        holdings[symbol].totalCost -= trade.price * (trade.oldQuantity || trade.quantity);
      }
    });

    // Get all symbols for live price fetch
    const symbols = Object.keys(holdings).filter(symbol => holdings[symbol].quantity > 0);

    // Fetch live prices
    const livePrices = await fetchLivePrices(symbols);

    // Update live prices in holdings
    symbols.forEach(symbol => {
      if (livePrices[symbol] && livePrices[symbol] > 0) {
        holdings[symbol].livePrice = livePrices[symbol];
      }
    });

    // Render current holdings
    for (const [symbol, holdingData] of Object.entries(holdings)) {
      if (holdingData.quantity <= 0) continue; // Don't render sold-out stocks

      const avgBuyPrice = holdingData.totalCost / holdingData.quantity;
      const marketValue = holdingData.livePrice * holdingData.quantity;
      const pl = marketValue - holdingData.totalCost;

      totalValue += marketValue;

      const row = document.createElement("div");
      row.className = "table-Row";
      const plClass = pl >= 0 ? "positive" : "negative";
      row.innerHTML = `
        <div class="stock">${symbol}</div>
        <div class="quantity">${holdingData.quantity}</div>
        <div class="price">₹${avgBuyPrice.toFixed(2)}</div>
        <div class="liveprice">₹${holdingData.livePrice.toFixed(2)}</div>
        <div class="total">₹${marketValue.toFixed(2)}</div>
        <div class="pl ${plClass}">${pl >= 0 ? "+" : ""}₹${pl.toFixed(2)}</div>
      `;
      tableBody.appendChild(row);
    }

    document.getElementById("total-value").textContent = `${totalValue.toFixed(2)}`;

    // Render chart after data is loaded
    renderChart();
  })
  .catch((error) => {
    console.error("Error loading portfolio:", error);
  });
