import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDt_hM9ShCj29JQt7NZkMn7Bz2J2vRobaY",
  authDomain: "tech-titans-expense-tracker.firebaseapp.com",
  projectId: "tech-titans-expense-tracker",
  storageBucket: "tech-titans-expense-tracker.firebasestorage.app",
  messagingSenderId: "75576976156",
  appId: "1:75576976156:web:48401db281aa69370d50d9",
  measurementId: "G-JVY0L232D2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);