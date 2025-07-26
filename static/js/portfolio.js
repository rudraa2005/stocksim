const uid = localStorage.getItem("uid");

fetch(`/portfolio/trades?uid=${uid}`)
  .then((res) => res.json())
  .then((data) => {
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
        holdings[symbol].quantity -= trade.oldQuantity; // Reduce by amount sold
        holdings[symbol].totalCost -= trade.price * trade.oldQuantity;
      }
    });

    // Render current holdings
    for (const [symbol, data] of Object.entries(holdings)) {
      if (data.quantity <= 0) continue; // Don't render sold-out stocks

      const avgBuyPrice = data.totalCost / data.quantity;
      const marketValue = data.livePrice * data.quantity;
      const pl = marketValue - data.totalCost;

      totalValue += marketValue;

      const row = document.createElement("div");
      row.className = "table-Row";
      row.innerHTML = `
        <div class="stock">${symbol}</div>
        <div class="quantity">${data.quantity}</div>
        <div class="price">${avgBuyPrice.toFixed(2)}</div>
        <div class="liveprice">${data.livePrice.toFixed(2)}</div>
        <div class="total">₹${marketValue.toFixed(2)}</div>
        <div class="pl">${pl >= 0 ? "+" : ""}${pl.toFixed(2)}</div>
      `;
      tableBody.appendChild(row);
    }

    document.getElementById("total-value").textContent = `${totalValue.toFixed(
      2
    )}`;
  });
