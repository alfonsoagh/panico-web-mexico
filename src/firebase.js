// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD8itA7shBr6YXbbRtvZ6-ERHBGQwJuKQ4",
  authDomain: "panico-mexico.firebaseapp.com",
  databaseURL: "https://panico-mexico-default-rtdb.firebaseio.com",
  projectId: "panico-mexico",
  storageBucket: "panico-mexico.appspot.com",
  messagingSenderId: "600814040168",
  appId: "1:600814040168:web:REEMPLAZA_CON_ID_WEB", // este cambia cuando registres app web
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
