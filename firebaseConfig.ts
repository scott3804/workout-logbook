import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import type { FirebaseApp } from "firebase/app"; // Type-only import
import type { Firestore } from "firebase/firestore"; // Type-only import

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase Core Services
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and export it
export const db: Firestore = getFirestore(app);
