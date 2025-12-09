 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyCuHw1C9oSsc1zqzLspMRESJmkLfhRhOl0",
    authDomain: "fir-stock-trading-app-b3dd4.firebaseapp.com",
    databaseURL: "https://fir-stock-trading-app-b3dd4-default-rtdb.firebaseio.com",
    projectId: "fir-stock-trading-app-b3dd4",
    storageBucket: "fir-stock-trading-app-b3dd4.appspot.com",
    messagingSenderId: "717923785755",
    appId: "1:717923785755:web:373291cf2263d7fcaa6cbe",
    measurementId: "G-75FXHXKPYR"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const uid =  
  document.getElementById("submit").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    console.log(" Email Input:", email);
    console.log("Password Input:", password);
    console.log(" Email Valid:", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      localStorage.setItem("token", idToken);
      localStorage.setItem("uid",user.uid);

      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });

      const data = await res.json();
      if (!res.ok) throw data;
      
      window.location.href = "/dashboard";
    } catch (err) {
      alert("Login failed.");
      console.error(err);
    }
  });

