import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = initializeApp(firebaseConfig);
// CRITICAL: The app will break without the firestoreDatabaseId passed in
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export const googleProvider = new GoogleAuthProvider();
// We'll also support GitHub but we need to import it
import { GithubAuthProvider } from "firebase/auth";
export const githubProvider = new GithubAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithGithub = () => signInWithPopup(auth, githubProvider);
export const logout = () => signOut(auth);
