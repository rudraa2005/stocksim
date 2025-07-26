const select_stock = document.getElementById("stock-select");
const btn = document.getElementById("select-button");
const bodyId = document.body.id;
if (bodyId === "trade"){
    let DataList = [];

    fetch('/trade/stocks')
    .then(res => res.json())
    .then(data => {
        DataList = data;
        console.log(data);
        const container = document.getElementById("stock-select");
        data.forEach(stock => {
        const stockElement = document.createElement("option");
        stockElement.textContent = `${stock.symbol}`;
        container.appendChild(stockElement);
  });

    btn.addEventListener("click", () => {
        const selectedSymbol = select_stock.value;
        const selectedStock = DataList.find(stock => stock.symbol === selectedSymbol);

        if (selectedStock) {
            localStorage.setItem("selectedStock", JSON.stringify(selectedStock));
            window.location.href = "/trade/buysell";
        } else {
            alert("Please select a valid stock.");
          }
    });
    });
} // Closing the if (bodyId === "trade") block
window.addEventListener("DOMContentLoaded", () => {
  const bodyId = document.body.id;

  if (bodyId === "buysell") {
    
    const stockInfoDiv = document.getElementById("rectangle7");
    const stockNamePara = document.createElement("p");
    const stockPricePara = document.createElement("p");
    const selectedStock = JSON.parse(localStorage.getItem("selectedStock"));

    if (selectedStock) {
      stockNamePara.textContent = `Name: ${selectedStock.name}`;
      stockPricePara.textContent = `Price: ₹${selectedStock.price.toFixed(2)}`;
    } else {
      stockNamePara.textContent = "No stock selected.";
    }

    stockInfoDiv.appendChild(stockNamePara);
    stockInfoDiv.appendChild(stockPricePara);

    const buy = document.getElementById("buy");
    buy.addEventListener("click", async () => {
    const uid= localStorage.getItem("uid");
    const amt = parseFloat(document.getElementById("buy-quantity").value);

    const response = await fetch(`/dashboard/balance?uid=${uid}`);
    const data = await response.json();
    let bal = data.balance;
    let newbal= 0
    const profit = data.profit || 0;
    const loss = data.loss || 0;
    const curr_price = selectedStock.price.toFixed(2);
    const totalCost = amt * selectedStock.price;
    if (totalCost>bal){
      alert("insufficient balance");
      window.location.href='/dashboard';
    }
    else{
      newbal = bal - totalCost;
    }
        await fetch("/dashboard/updated_balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uid,  
          balance: newbal,
          price: curr_price,
          loss: loss,
          timestamp: Date.now(),
          quantity: amt,
          totalCost: totalCost,
          symbol: selectedStock.symbol
        })
      });
    const token = localStorage.getItem("token");
    alert(`You bought ${amt} shares of ${selectedStock.symbol} for ₹${totalCost.toFixed(2)}!`);
    console.log("Redirecting to dashboard...");
    window.location.href = "/dashboard";
    });

const sell = document.getElementById("sell");
sell.addEventListener("click", async () => {
  const uid = localStorage.getItem("uid");
  const amt = parseFloat(document.getElementById("buy-quantity").value);
  const token = localStorage.getItem("token");

  const selectedStock = JSON.parse(localStorage.getItem("selectedStock"));
  const curr_price = selectedStock.price.toFixed(2);
  const totalValue = amt * selectedStock.price;

  // 1. Get current balance and holdings
  let ownedQuantity=0;
  const response = await fetch(`/portfolio/trades?uid=${uid}`);
  const data = await response.json();
  data.forEach(trade => {
    if (trade.symbol === selectedStock.symbol) {
      if (trade.sell) {
        ownedQuantity -= trade.quantity;
      } else {
        ownedQuantity += trade.quantity;
      }
    }
});
  
  if (amt > ownedQuantity) {
    alert(`You don't own enough shares to sell. You have only ${ownedQuantity}.`);
    window.location.href = '/trade';
    return;
  }
  const balRes = await fetch(`/dashboard/balance?uid=${uid}`);
  const balData = await balRes.json();
  const bal = balData.balance || 0;
  const newbal = bal + totalValue;
  const newQuantity = ownedQuantity-amt;
  await fetch("/dashboard/update_sell", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: uid,
      symbol: selectedStock.symbol,
      quantity: amt,
      price: curr_price,
      totalValue: totalValue,
      balance: newbal,
      newQuantity: newQuantity,
      timestamp: Date.now()
    })
  });

  alert(`You sold ${amt} shares of ${selectedStock.symbol} for ₹${totalValue.toFixed(2)}!`);
  console.log("Redirecting to dashboard...");
  window.location.href = "/dashboard";
});
  
  const ctx = document.getElementById('stockChart').getContext('2d');

  const stockChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [], // placeholder
      datasets: [{
        label: 'Stock Price (₹)',
        data: [],
        borderColor: 'rgba(255, 255, 255, 0.8)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#fff' },
          grid: { color: '#444' }
        },
        y: {
          ticks: { color: '#fff' },
          grid: { color: '#444' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#fff' }
        }
      }
    }
  });

  fetch(`/api/stock-data?symbol=${selectedStock.symbol}`)
  .then(res => res.json())
  .then(data => {
    console.log(data.labels)
    stockChart.data.labels = data.labels;
    stockChart.data.datasets[0].data = data.prices;
    stockChart.data.datasets[0].label = `${selectedStock.symbol} Price (₹)`;
    stockChart.update();
  })
  .catch(err => {
    console.error("Error loading stock data:", err);
  });
  }
})