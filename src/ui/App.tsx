import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { initAnalytics } from "../firebase/firebase";
import AppRoutes from "./routes";

type Branding = {
  brand_name: string;
  primary?: string;
  secondary?: string;
  accent?: string;
  overall_black?: string;
  logo_url?: string;
  google_font_href?: string;
  font_family?: string;
  font_zoom?: number;
  spacing_unit?: number;
};

export default function App() {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    initAnalytics().catch(() => undefined);
    const apiBase = (import.meta.env.VITE_CORE_API_BASE_URL || "").trim();
    const tenant = import.meta.env.VITE_TENANT_DOMAIN || "";
    fetch(`${apiBase}/public/branding`, {
      headers: tenant ? { "X-Tenant-Domain": tenant } : undefined
    })
      .then((r) => r.json())
      .then((b) => setBranding(b))
      .catch(() => setBranding({ brand_name: "STR Admin" }));
  }, []);

  useEffect(() => {
    const href =
      branding?.google_font_href ||
      "https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap";
    const id = "wl-google-font";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [branding?.google_font_href]);

  const theme = useMemo(() => {
    const primary = branding?.primary || "#1976d2";
    const secondary = branding?.secondary || "#9c27b0";
    const accent = branding?.accent || "#ff6d00";
    const overallBlack = branding?.overall_black || "rgba(0,0,0,0.84)";
    const fontFamily =
      branding?.font_family ||
      'Ubuntu, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
    const spacingUnit = typeof branding?.spacing_unit === "number" ? branding.spacing_unit : 8;
    const fontZoom = typeof branding?.font_zoom === "number" && branding.font_zoom > 0 ? branding.font_zoom : 1;

    return createTheme({
      palette: {
        mode: "light",
        primary: { main: primary },
        secondary: { main: secondary },
        info: { main: accent }, // used as "accent"
        text: {
          primary: overallBlack,
          secondary: "rgba(0,0,0,0.64)"
        }
      },
      spacing: spacingUnit,
      shape: { borderRadius: 14 },
      typography: {
        fontFamily,
        // Keep body sizing stable; zoom focuses on headings.
        fontSize: 14,
        h1: { fontWeight: 900, letterSpacing: -1.2, fontSize: `${(44 * fontZoom).toFixed(2)}px` },
        h2: { fontWeight: 900, letterSpacing: -1.0, fontSize: `${(36 * fontZoom).toFixed(2)}px` },
        h3: { fontWeight: 900, letterSpacing: -0.8, fontSize: `${(30 * fontZoom).toFixed(2)}px` },
        h4: { fontWeight: 800, letterSpacing: -0.5, fontSize: `${(26 * fontZoom).toFixed(2)}px` },
        h5: { fontWeight: 800, letterSpacing: -0.35, fontSize: `${(20 * fontZoom).toFixed(2)}px` },
        h6: { fontWeight: 800, letterSpacing: -0.25, fontSize: `${(18 * fontZoom).toFixed(2)}px` }
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            ":root": {
              "--wl-primary": primary,
              "--wl-secondary": secondary,
              "--wl-accent": accent,
              "--wl-overall-black": overallBlack,
              "--wl-font-family": fontFamily,
              "--wl-spacing-unit": String(spacingUnit),
              "--wl-font-zoom": String(fontZoom)
            },
            body: {
              fontFamily,
              color: overallBlack
            }
          }
        },
        MuiCard: { styleOverrides: { root: { borderRadius: 18 } } },
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } }
      }
    });
  }, [branding]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRoutes title={branding?.brand_name || "STR Admin"} />
    </ThemeProvider>
  );
}
