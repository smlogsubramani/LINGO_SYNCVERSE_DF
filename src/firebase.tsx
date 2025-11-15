import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";  
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
 
const firebaseConfig = {
  apiKey: "AIzaSyDC9IvtQY4Hx4xQXd1unbKYMaPqSl6XJYQ",
  authDomain: "syncverse-b0d18.firebaseapp.com",
  projectId: "syncverse-b0d18",
  storageBucket: "syncverse-b0d18.firebasestorage.app",
  messagingSenderId: "466703886707",
  appId: "1:466703886707:web:fab59664351d3346edbd06",
  measurementId: "G-0Q4BJGXCQ7"
};
 
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);  
export const auth = getAuth(app);
export const storage = getStorage(app);