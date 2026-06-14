// src/firebase-config.js

// 1. Import the core Firebase App module
import { initializeApp } from "firebase/app";

// 2. Import the Auth and Database modules
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// 3. Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkOuTAr0QcIQ0aTwksCXLzjpGlgZxQyFg",
  authDomain: "aqua-fish-controller.firebaseapp.com",
  databaseURL: "https://aqua-fish-controller-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aqua-fish-controller",
  storageBucket: "aqua-fish-controller.firebasestorage.app",
  messagingSenderId: "658729773596",
  appId: "1:658729773596:web:22224dceb1e0a7803b8dd9"
};

// 4. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 5. Export the initialized Auth and DB instances so state.js can use them
export const auth = getAuth(app);
export const db = getDatabase(app);

/* ⚠️ Quick Note on Imports (If you get a browser error)
Because you generated the script tag from Firebase, I noticed it used the direct URL (https://www.gstatic.com/...).

If you are building this website without a bundler (like Vite, Webpack, or React) and just using pure HTML/JS files, your browser might throw an error saying it doesn't understand "firebase/app".

If that happens, you simply need to swap the import links in both firebase-config.js and state.js to point to the web URLs matching your version (12.14.0):

In firebase-config.js:

JavaScript
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
In state.js:

JavaScript
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
If you are using a bundler (or an import map), the original code I provided at the top will work perfectly as is! */