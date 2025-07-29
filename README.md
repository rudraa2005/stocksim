# StockSim 🧾📈

StockSim is a simulated stock trading dashboard that lets users practice trading stocks in real-time using fake money. It features live price updates, portfolio management, trade history, and balance tracking. Built with Flask (Python), Firebase, and a simple frontend using HTML, CSS, JS, and Chart.js.

---

## 🚀 Features

- 📊 **Real-Time Stock Prices**  
  Live updates for selected stocks via external APIs.

- 🛒 **Buy & Sell Functionality**  
  Users can simulate buying and selling shares using a virtual balance.

- 👤 **User Authentication**  
  Firebase-backed login and signup (email/password).

- 💼 **Portfolio Tracker**  
  Visual breakdown of stock holdings, average prices, and returns.

- 📈 **Trade History & Analytics**  
  Record of all buy/sell actions with Chart.js visualizations.

- 🔐 **JWT-Protected Routes**  
  Secure backend APIs for authenticated access.

---

## 🧱 Tech Stack

| Frontend        | Backend     | Database      | Tools         |
|----------------|-------------|---------------|----------------|
| HTML/CSS/JS     | Flask (Python) | Firebase Firestore | Chart.js     |
| Bootstrap (optional) | Flask-JWT-Extended | Firebase Auth     | Render (Hosting) |

---

## 🛠️ Setup Instructions

### 🔧 Backend (Flask)

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/StockSim.git
   cd StockSim/backend
