import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getAuth } from "firebase/auth";
// import { initializeApp } from "firebase/app";
import type { Auth, UserCredential } from "firebase/auth"; // Type-only import

// Reference our existing initialized Firebase app instance
const auth: Auth = getAuth();
const googleProvider = new GoogleAuthProvider();

export { auth };

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

export async function logoutUser(): Promise<void> {
  return signOut(auth);
}
