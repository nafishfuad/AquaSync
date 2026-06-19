import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, get, query, orderByChild, equalTo, set, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkOuTAr0QcIQ0aTwksCXLzjpGlgZxQyFg",
  authDomain: "aqua-fish-controller.firebaseapp.com",
  databaseURL: "https://aqua-fish-controller-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aqua-fish-controller",
  storageBucket: "aqua-fish-controller.firebasestorage.app",
  messagingSenderId: "658729773596",
  appId: "1:658729773596:web:22224dceb1e0a7803b8dd9",
  measurementId: "G-8ZTMQXRVW6"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
