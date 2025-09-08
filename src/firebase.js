import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// 🔁 Rellena con TU config del proyecto (la misma de Android)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://TU_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "XXXX",
  appId: "1:XXXX:web:YYYY"
};

export const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
