const token = localStorage.getItem("token");
document.getElementById("loader").style.display = "flex";
const uid = localStorage.getItem("uid");
if (!token) {
  alert("Session expired. Please log in.");
  window.location.href = "/auth/login";
}

fetch("/dashboard", {
  headers: { Authorization: `Bearer ${token}` }
})
  .then((res) => res.text())
  .then((data) => {
    console.log("Protected data fetched successfully:");
  })
  .catch((err) => console.error("Error fetching protected data:", err));

fetch(`/dashboard/balance?uid=${uid}`, {
  headers: { Authorization: `Bearer ${token}` }
})
  .then((res) => res.json())
  .then((data) => {
    const balance = data.balance;
    const profit= data.profit;
    const loss= data.loss;
    const name= data.name;
    document.getElementById("balance").innerText = `₹${balance.toFixed(2)}`;
    document.getElementById("p").innerText = `₹${profit.toFixed(2)}`;
    document.getElementById("l").innerText = `₹${loss.toFixed(2)}`;
    document.getElementById("username-span").innerText= name;
  })
  .catch((err) => {
    console.error("Error fetching balance:", err);
    document.getElementById("balance-span").innerText = "₹0.00";
  });


fetch("dashboard/watchlist", {
  headers: { Authorization: `Bearer ${token}` }
})
.then((res)=> res.json())
.then((data)=>{
  console.log("API response:", data);
  const container = document.getElementById("stock_info");  
  data.forEach(stock => { //rendering through an array
      const stockElement = document.createElement("p");
      stockElement.textContent = `${stock.name} (${stock.symbol}) - ₹${stock.price}    `;
      container.appendChild(stockElement);
  });
})
.catch((err) => {
    console.error("Error fetching watchlist:", err);

})
.finally(()=>{
  document.getElementById("loader").style.display= "none";
  document.getElementById("main-content").style.display="Block";
})
window.addEventListener("DOMContentLoaded", () => {
  const name = localStorage.getItem("name");
  console.log(name)
  if(name){
    document.getElementById("username-span").innerText = username.toUpperCase();
  }

});
