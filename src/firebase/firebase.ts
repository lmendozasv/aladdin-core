import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function readEnv(k: string): string {
  return String((import.meta as any)?.env?.[k] ?? "").trim();
}

export const firebaseConfigErrors: string[] = [];

function getFirebaseConfig(): FirebaseConfig | null {
  const cfg: FirebaseConfig = {
    apiKey: readEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("VITE_FIREBASE_APP_ID"),
    measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID") || undefined
  };

  const required: (keyof FirebaseConfig)[] = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ];
  const missing = required.filter((k) => !cfg[k]);
  if (missing.length) {
    firebaseConfigErrors.push(
      `Firebase env missing: ${missing.map((m) => `VITE_FIREBASE_${String(m).toUpperCase()}`).join(", ")}`
    );
    return null;
  }
  return cfg;
}

const firebaseConfig = getFirebaseConfig();

export const firebaseConfigured = !!firebaseConfig;

export const firebaseApp = firebaseConfig ? initializeApp(firebaseConfig) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

export async function initAnalytics() {
  if (typeof window === "undefined") return;
  if (!firebaseApp) return;
  if (!(await analyticsSupported())) return;
  getAnalytics(firebaseApp);
}
