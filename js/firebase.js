import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDuXav8x9SYny10CZwnLUvwr_B44GeIets",
    authDomain: "pokemon-47cae.firebaseapp.com",
    projectId: "pokemon-47cae",
    storageBucket: "pokemon-47cae.firebasestorage.app",
    messagingSenderId: "1098874974083",
    appId: "1:1098874974083:web:2547c6f2ece0edace090b6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'pokemon-game-main';

export { auth, db, appId, signInAnonymously, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, onSnapshot };