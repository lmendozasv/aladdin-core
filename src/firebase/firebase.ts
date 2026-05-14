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
export const firebaseConfigHints: string[] = [];

function getFirebaseConfig(): FirebaseConfig | null {
  // Hot-reload safety: recompute each load and don't accumulate stale errors.
  firebaseConfigErrors.length = 0;
  firebaseConfigHints.length = 0;
  const cfg: FirebaseConfig = {
    apiKey: readEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("VITE_FIREBASE_APP_ID"),
    measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID") || undefined
  };

  if (cfg.apiKey) firebaseConfigHints.push(`apiKey: …${cfg.apiKey.slice(-6)} (len=${cfg.apiKey.length})`);
  if (cfg.projectId) firebaseConfigHints.push(`projectId: ${cfg.projectId}`);
  if (cfg.authDomain) firebaseConfigHints.push(`authDomain: ${cfg.authDomain}`);

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
    const mapEnvName = (k: keyof FirebaseConfig) => {
      switch (k) {
        case "apiKey":
          return "VITE_FIREBASE_API_KEY";
        case "authDomain":
          return "VITE_FIREBASE_AUTH_DOMAIN";
        case "projectId":
          return "VITE_FIREBASE_PROJECT_ID";
        case "storageBucket":
          return "VITE_FIREBASE_STORAGE_BUCKET";
        case "messagingSenderId":
          return "VITE_FIREBASE_MESSAGING_SENDER_ID";
        case "appId":
          return "VITE_FIREBASE_APP_ID";
        case "measurementId":
          return "VITE_FIREBASE_MEASUREMENT_ID";
        default:
          return String(k);
      }
    };
    firebaseConfigErrors.push(`Firebase env missing: ${missing.map(mapEnvName).join(", ")}`);
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
