import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"

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

document.getElementById("Create").addEventListener("click", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const name = document.getElementById("name").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Optionally save to Firestore if needed (just for extra profile info)
    const idToken = await user.getIdToken();

    await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, idToken })
    });
    
    
    alert("✅ Registered successfully!");
    window.location.href = "/auth/login";
  } catch (err) {
    alert("❌ " + (err.message || "Registration failed."));
    console.error(err);
  }
});
const name = document.getElementById("name").value;
localStorage.setItem("name",name)