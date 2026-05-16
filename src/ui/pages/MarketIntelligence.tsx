import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import dayjs from "dayjs";
import { listAssets } from "../../api/core";
import { getAccessToken } from "../../state/session";

declare global {
  interface Window {
    mapboxgl?: any;
    L?: any;
  }
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtPct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function fmtMoney(v: number) {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function heatColor(v01: number) {
  // red -> orange -> yellow -> green
  const v = clamp(v01, 0, 1);
  const hue = Math.round(v * 120); // 0=red, 60=yellow, 120=green
  return `hsl(${hue} 85% 52%)`;
}

type HeatPoint = {
  id: string;
  lat: number;
  lng: number;
  score01: number;
  submarket: string;
  marketScore: number;
  adr: number;
  occupancy: number;
  revenueMonthly: number;
  competitors: number;
  demandLabel: "High" | "Medium" | "Low";
};

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
      {value === index ? children : null}
    </Box>
  );
}

function loadMapbox(accessToken: string | undefined, onLoaded: () => void, onError: (msg: string) => void) {
  if (!accessToken) return;
  const isV2 = typeof window.mapboxgl?.version === "string" && window.mapboxgl.version.startsWith("2.");
  if (window.mapboxgl && isV2) {
    onLoaded();
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-mapbox-gl-v2="1"]');
  if (existing) {
    existing.addEventListener("load", onLoaded, { once: true });
    existing.addEventListener("error", () => onError("Failed to load Mapbox GL JS (script error)."), { once: true });
    return;
  }
  // Ensure v2 is used even if a previous version is already present.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).mapboxgl = undefined;
  } catch {
    // ignore
  }

  // Use Mapbox GL JS v2.x for broader browser/driver compatibility (v3.x is stricter).
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css";
  css.dataset.mapboxGlV2Css = "1";
  css.onerror = () => onError("Failed to load Mapbox GL CSS.");
  document.head.appendChild(css);

  const s = document.createElement("script");
  s.dataset.mapboxGlV2 = "1";
  s.async = true;
  s.defer = true;
  s.src = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js";
  s.onload = onLoaded;
  s.onerror = () => onError("Failed to load Mapbox GL JS (network/CSP).");
  document.head.appendChild(s);
}

function loadLeaflet(onLoaded: () => void, onError: (msg: string) => void) {
  const ensureHeat = () => {
    if (!window.L) return;
    if (typeof window.L.heatLayer === "function") {
      onLoaded();
      return;
    }
    const heatExisting = document.querySelector<HTMLScriptElement>('script[data-leaflet-heat="1"]');
    if (heatExisting) {
      // If it's already loaded, proceed; otherwise wait for load.
      if (typeof window.L.heatLayer === "function") onLoaded();
      else {
        heatExisting.addEventListener("load", onLoaded, { once: true });
        heatExisting.addEventListener("error", () => onError("Failed to load Leaflet heat plugin (script error)."), { once: true });
      }
      return;
    }
    const hs = document.createElement("script");
    hs.dataset.leafletHeat = "1";
    hs.async = true;
    hs.defer = true;
    hs.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
    hs.onload = onLoaded;
    hs.onerror = () => onError("Failed to load Leaflet heat plugin (network/CSP).");
    document.head.appendChild(hs);
  };

  // If Leaflet is already present (HMR/previous page), only ensure the heat plugin.
  if (window.L) {
    ensureHeat();
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet="1"]');
  if (existing) {
    existing.addEventListener("load", ensureHeat, { once: true });
    existing.addEventListener("error", () => onError("Failed to load Leaflet (script error)."), { once: true });
    return;
  }

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  css.dataset.leafletCss = "1";
  css.onerror = () => onError("Failed to load Leaflet CSS (network/CSP).");
  document.head.appendChild(css);

  const s = document.createElement("script");
  s.dataset.leaflet = "1";
  s.async = true;
  s.defer = true;
  s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  s.onload = () => {
    ensureHeat();
  };
  s.onerror = () => onError("Failed to load Leaflet JS (network/CSP).");
  document.head.appendChild(s);
}

function LeafletZoneHeatMap({
  center,
  points,
  zoneLabel
}: {
  center: { lat: number; lng: number };
  points: HeatPoint[];
  zoneLabel: string;
  base: { adr: number; occupancy: number; competitors: number };
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<{ heat?: any; markers?: any }>({});
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<HeatPoint | null>(null);

  useEffect(() => {
    loadLeaflet(
      () => setReady(true),
      (msg) => setMapError(msg)
    );
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!mapEl.current) return;
    if (!window.L) return;

    const L = window.L;

    // If HMR/remount replaced the container, recreate.
    const existing = mapRef.current;
    if (existing && existing.getContainer && existing.getContainer() !== mapEl.current) {
      try {
        existing.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      setMapLoaded(false);
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapEl.current, {
        center: [center.lat, center.lng],
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors"
      }).addTo(mapRef.current);

      // Resize handling for flex/grid.
      try {
        resizeObserverRef.current?.disconnect?.();
        resizeObserverRef.current = new ResizeObserver(() => {
          try {
            mapRef.current?.invalidateSize?.({ animate: false });
          } catch {
            // ignore
          }
        });
        if (mapEl.current) resizeObserverRef.current.observe(mapEl.current);
      } catch {
        // ignore
      }

      setMapLoaded(true);
      // Let layout settle then invalidate.
      setTimeout(() => {
        try {
          mapRef.current?.invalidateSize?.({ animate: false });
        } catch {
          // ignore
        }
      }, 0);
    } else {
      try {
        mapRef.current.setView?.([center.lat, center.lng], mapRef.current.getZoom?.() ?? 13, { animate: false });
      } catch {
        // ignore
      }
    }
  }, [ready, center.lat, center.lng]);

  useEffect(() => {
    if (!ready) return;
    if (!mapLoaded) return;
    if (!mapRef.current) return;
    if (!window.L) return;

    const L = window.L;
    const map = mapRef.current;
    setOverlayReady(false);

    try {
      layersRef.current.heat?.remove?.();
    } catch {
      // ignore
    }
    try {
      layersRef.current.markers?.clearLayers?.();
    } catch {
      // ignore
    }

    try {
      // Use a multi-color gradient similar to the previous Mapbox heatmap.
      const gradient = {
        0.0: "rgba(0,0,0,0)",
        0.15: "#ff3b30",
        0.45: "#ff9500",
        0.7: "#ffcc00",
        1.0: "#34c759"
      };

      const heatPts = points.map((p) => [p.lat, p.lng, clamp(p.score01, 0, 1)]);
      layersRef.current.heat = L.heatLayer(heatPts, {
        radius: 34,
        blur: 22,
        max: 1.0,
        maxZoom: 18,
        minOpacity: 0.35,
        gradient
      }).addTo(map);
    } catch (e: any) {
      setMapError(`Heat layer error: ${String(e?.message || e)}`);
    }

    // Ensure markers are above the heat layer.
    const markers = L.layerGroup().addTo(map);
    layersRef.current.markers = markers;

    for (const p of points) {
      const color = heatColor(p.score01);
      const html = `
        <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height: 1.35;">
          <div style="font-weight: 800; margin-bottom: 4px;">${p.submarket}</div>
          <div style="opacity: 0.75; margin-bottom: 6px;">${zoneLabel}</div>
          <div style="margin-top: 6px;"><span style="font-weight: 700;">Market Score:</span> ${p.marketScore}</div>
          <div style="margin-top: 6px; opacity: 0.95;">
            <div><span style="font-weight: 700;">ADR:</span> $${Math.round(p.adr)}</div>
            <div><span style="font-weight: 700;">Occupancy:</span> ${Math.round(p.occupancy * 100)}%</div>
            <div><span style="font-weight: 700;">Estimated revenue:</span> $${Math.round(p.revenueMonthly).toLocaleString()}/mo</div>
            <div><span style="font-weight: 700;">Competitors:</span> ${p.competitors}</div>
            <div><span style="font-weight: 700;">Demand:</span> ${p.demandLabel}</div>
          </div>
        </div>
      `;

      const m = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: "rgba(0,0,0,0.25)",
        weight: 1,
        fillColor: color,
        fillOpacity: 0.8
      });
      m.bindPopup(html, { closeButton: false, autoClose: true, closeOnClick: false, maxWidth: 260 } as any);
      m.on("mouseover", () => m.openPopup());
      m.on("mouseout", () => m.closePopup());
      m.on("click", () => setSelectedPoint(p));
      m.addTo(markers);
    }

    setOverlayReady(true);
  }, [ready, mapLoaded, points, zoneLabel]);

  useEffect(() => {
    return () => {
      try {
        resizeObserverRef.current?.disconnect?.();
      } catch {
        // ignore
      }
      resizeObserverRef.current = null;
      try {
        mapRef.current?.remove?.();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
  }, []);

  return (
    <Box sx={{ position: "relative", height: "100%", minHeight: 520, overflow: "visible", bgcolor: "transparent" }}>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.02) inset",
          pointerEvents: "none",
          zIndex: 1
        }}
      />
      <Box ref={mapEl} sx={{ position: "absolute", inset: 0, zIndex: 0 }} />
      <Box
        sx={{
          position: "absolute",
          left: 12,
          top: 12,
          zIndex: 2,
          bgcolor: "rgba(255,255,255,0.92)",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          px: 1.25,
          py: 0.75,
          display: "flex",
          gap: 1,
          alignItems: "center"
        }}
      >
        <Chip size="small" label="Potential" />
        <Chip size="small" variant="outlined" label={mapLoaded ? "Map: ready" : ready ? "Map: loading" : "Map: init"} sx={{ height: 22 }} />
        <Chip size="small" variant="outlined" label={overlayReady ? `Overlay: ${points.length} pts` : "Overlay: loading"} sx={{ height: 22 }} />
      </Box>
      {!ready ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.paper"
          }}
        >
          <Stack spacing={1} alignItems="center">
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Loading map…
            </Typography>
          </Stack>
        </Box>
      ) : null}
      {mapError ? (
        <Box
          sx={{
            position: "absolute",
            left: 12,
            bottom: 12,
            right: 12,
            bgcolor: "rgba(255,255,255,0.92)",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            px: 1.25,
            py: 1
          }}
        >
          <Typography variant="caption" color="error" sx={{ fontWeight: 700 }}>
            Map error: {mapError}
          </Typography>
        </Box>
      ) : null}

      <Dialog open={Boolean(selectedPoint)} onClose={() => setSelectedPoint(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Submarket detail</DialogTitle>
        <DialogContent dividers>
          {selectedPoint ? (
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 800 }}>{selectedPoint.submarket}</Typography>
              <Typography variant="body2" color="text.secondary">
                {zoneLabel}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Market score
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {selectedPoint.marketScore}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Demand
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {selectedPoint.demandLabel}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        ADR
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        ${Math.round(selectedPoint.adr)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Occupancy
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {Math.round(selectedPoint.occupancy * 100)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Estimated monthly revenue
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        ${Math.round(selectedPoint.revenueMonthly).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPoint(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ZoneHeatMap({
  center,
  points,
  zoneLabel,
  base
}: {
  center: { lat: number; lng: number };
  points: HeatPoint[];
  zoneLabel: string;
  base: { adr: number; occupancy: number; competitors: number };
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const accessTokenRaw = (import.meta as any).env?.VITE_PUBLIC_MAPBOX_ACCESS_TOKEN as string | undefined;
  const accessToken = accessTokenRaw?.trim();
  const sourceId = "mi-heat-src";
  const heatLayerId = "mi-heat-heat";
  const pointsLayerId = "mi-heat-points";
  const [mapLoaded, setMapLoaded] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<HeatPoint | null>(null);
  const [mapDebug, setMapDebug] = useState<string | null>(null);
  const [forceOsmBase, setForceOsmBase] = useState(false);
  const [mapHealth, setMapHealth] = useState<string>("init");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  const [paintProbe, setPaintProbe] = useState<string>("");
  const [renderMode, setRenderMode] = useState<"live" | "image">("image");
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const frameLoopRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const osmStyle = useMemo(
    () => ({
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    }),
    []
  );

  useEffect(() => {
    // Render-mode "image": mirror the WebGL canvas to an <img> to bypass compositor issues.
    if (renderMode !== "image") return;
    if (!mapLoaded) return;
    const map = mapRef.current;
    const canvas = map?.getCanvas?.();
    if (!canvas?.toDataURL) return;

    const tick = (t: number) => {
      frameLoopRef.current = requestAnimationFrame(tick);
      // Throttle to ~4 fps to reduce CPU usage.
      if (t - lastFrameAtRef.current < 250) return;
      lastFrameAtRef.current = t;
      try {
        map?.triggerRepaint?.();
        const url = canvas.toDataURL("image/png");
        if (typeof url === "string" && url.startsWith("data:image")) setFrameUrl(url);
      } catch {
        // ignore
      }
    };
    frameLoopRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    };
  }, [renderMode, mapLoaded]);

  useEffect(() => {
    // In image mode, hide only the WebGL canvas, but keep the Mapbox DOM (controls + hit-testing)
    // alive and interactive so tooltips/click/drag/zoom still work.
    const map = mapRef.current;
    if (!map) return;
    try {
      const canvas = map.getCanvas?.();
      if (!canvas?.style) return;
      // Don't set to 0: some browsers stop delivering pointer events reliably.
      canvas.style.opacity = renderMode === "image" ? "0.0001" : "1";
      canvas.style.pointerEvents = "auto";
      const container = map.getContainer?.();
      if (container?.style) container.style.pointerEvents = "auto";
    } catch {
      // ignore
    }
  }, [renderMode, mapLoaded]);

  useEffect(() => {
    const t = setInterval(() => {
      const map = mapRef.current;
      if (!map) {
        setMapHealth("no-map");
        return;
      }
      try {
        const canvas = map.getCanvas?.();
        const rect = canvas?.getBoundingClientRect?.();
        const w = Math.round(rect?.width || 0);
        const h = Math.round(rect?.height || 0);
        const styleLoaded = Boolean(map.isStyleLoaded?.());
        const tilesLoaded = Boolean(map.areTilesLoaded?.());
        const loaded = Boolean(map.loaded?.());
        setMapHealth(
          `canvas=${w}x${h} loaded=${loaded ? "1" : "0"} style=${styleLoaded ? "1" : "0"} tiles=${tilesLoaded ? "1" : "0"} base=${
            forceOsmBase ? "osm" : "mapbox"
          }`
        );

        // Probe what element is actually on top of the map area (helps detect overlays hiding the canvas).
        const px = Math.round((rect?.left || 0) + (rect?.width || 0) / 2);
        const py = Math.round((rect?.top || 0) + (rect?.height || 0) / 2);
        const el = document.elementFromPoint(px, py) as HTMLElement | null;
        const elTag = el?.tagName?.toLowerCase?.() || "none";
        const elClass = (el?.className && String(el.className).split(" ").slice(0, 3).join(".")) || "";
        const cs = canvas ? window.getComputedStyle(canvas) : null;
        const cOpacity = cs?.opacity || "?";
        const cVis = cs?.visibility || "?";
        const cDisplay = cs?.display || "?";
        const cZ = cs?.zIndex || "?";
        const cPE = cs?.pointerEvents || "?";
        const cMix = cs?.mixBlendMode || "?";
        const cFilter = cs?.filter || "?";
        const elCs = el ? window.getComputedStyle(el) : null;
        const elBg = elCs?.backgroundColor || "?";
        const elOp = elCs?.opacity || "?";
        const elZ = elCs?.zIndex || "?";
        const elPE = elCs?.pointerEvents || "?";
        setPaintProbe(
          `${elTag}${elClass ? "." + elClass : ""} bg=${elBg} op=${elOp} z=${elZ} pe=${elPE} | canvas z=${cZ} pe=${cPE} disp=${cDisplay} vis=${cVis} op=${cOpacity} mix=${cMix} filter=${cFilter}`
        );
      } catch {
        setMapHealth("health-error");
      }
    }, 800);
    return () => clearInterval(t);
  }, [forceOsmBase]);

  useEffect(() => {
    loadMapbox(
      accessToken,
      () => setReady(true),
      (msg) => setMapError(msg)
    );
  }, [accessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!mapEl.current) return;
    if (!window.mapboxgl) return;
    if (!accessToken) return;

    // If HMR or remounting replaced the container, recreate the map.
    const existing = mapRef.current;
    if (existing && existing.getContainer && existing.getContainer() !== mapEl.current) {
      try {
        existing.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      setMapLoaded(false);
    }

    if (!mapRef.current) {
      window.mapboxgl.accessToken = accessToken;
      const mapboxStyleUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${encodeURIComponent(accessToken)}`;
      mapRef.current = new window.mapboxgl.Map({
        container: mapEl.current,
        style: forceOsmBase ? (osmStyle as any) : mapboxStyleUrl,
        center: [center.lng, center.lat],
        zoom: 12.6,
        pitch: 0,
        attributionControl: false,
        antialias: true,
        // Firefox: helps avoid "blank until interaction" WebGL presentation glitches.
        preserveDrawingBuffer: true,
        dragPan: true,
        scrollZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        touchZoomRotate: true
      });
      popupRef.current = new window.mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "260px" });
      mapRef.current.addControl(new window.mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      mapRef.current.addControl(new window.mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      // Keep the map responsive even when embedded in flex/grid/tabs.
      try {
        resizeObserverRef.current?.disconnect?.();
        resizeObserverRef.current = new ResizeObserver(() => {
          try {
            mapRef.current?.resize?.();
            mapRef.current?.triggerRepaint?.();
          } catch {
            // ignore
          }
        });
        if (mapEl.current) resizeObserverRef.current.observe(mapEl.current);
      } catch {
        // ignore
      }

      mapRef.current.on("load", () => {
        setMapLoaded(true);
        // Firefox compositor nudge: ensure the WebGL canvas is on its own layer.
        try {
          const canvas = mapRef.current?.getCanvas?.();
          if (canvas && canvas.style) {
            canvas.style.transform = "translate3d(0,0,0)";
            canvas.style.willChange = "transform";
            canvas.style.backfaceVisibility = "hidden";
            // Avoid filters on the canvas; some Firefox setups end up compositing it incorrectly.
            canvas.style.filter = "none";
            // Tiny opacity nudge (should be visually identical) that can fix certain compositor glitches.
            canvas.style.opacity = "0.9999";
          }
        } catch {
          // ignore
        }
        // Firefox "blank until readback" workaround: force a tiny GPU readback once,
        // which can kick the compositor on some drivers.
        try {
          const canvas = mapRef.current?.getCanvas?.();
          const gl: any =
            canvas?.getContext?.("webgl2", { preserveDrawingBuffer: true }) ||
            canvas?.getContext?.("webgl", { preserveDrawingBuffer: true });
          if (gl?.readPixels) {
            const px = new Uint8Array(4);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            gl.flush?.();
            gl.finish?.();
          }
        } catch {
          // ignore
        }
        // If Firefox only presents after a canvas readback (similar to clicking Snapshot),
        // do a lightweight toDataURL once and discard it.
        try {
          const canvas = mapRef.current?.getCanvas?.();
          if (canvas?.toDataURL) {
            requestAnimationFrame(() => {
              try {
                void canvas.toDataURL("image/png");
              } catch {
                // ignore
              }
            });
            setTimeout(() => {
              try {
                void canvas.toDataURL("image/png");
              } catch {
                // ignore
              }
            }, 250);
          }
        } catch {
          // ignore
        }
        try {
          const canvas = mapRef.current?.getCanvas?.();
          if (canvas && canvas.addEventListener) {
            const onLost = (ev: any) => {
              try {
                ev?.preventDefault?.();
              } catch {
                // ignore
              }
              setWebglLost(true);
              setMapDebug("webglcontextlost");
            };
            const onRestored = () => {
              setWebglLost(false);
              setMapDebug("webglcontextrestored");
              try {
                mapRef.current?.resize?.();
                mapRef.current?.triggerRepaint?.();
              } catch {
                // ignore
              }
            };
            canvas.addEventListener("webglcontextlost", onLost, false);
            canvas.addEventListener("webglcontextrestored", onRestored, false);
          }
        } catch {
          // ignore
        }
        // Force a short repaint loop; some Firefox/GPU combos won't present the WebGL canvas
        // until a user interaction or a few animation frames have occurred.
        try {
          const map = mapRef.current;
          const start = performance.now();
          const tick = (t: number) => {
            try {
              map?.triggerRepaint?.();
              map?.resize?.();
            } catch {
              // ignore
            }
            if (t - start < 4000) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        } catch {
          // ignore
        }
        try {
          // Explicitly enable pan/zoom handlers (some browser setups can end up disabled).
          mapRef.current.dragPan?.enable?.();
          mapRef.current.scrollZoom?.enable?.();
          mapRef.current.boxZoom?.enable?.();
          mapRef.current.doubleClickZoom?.enable?.();
          mapRef.current.keyboard?.enable?.();
          mapRef.current.touchZoomRotate?.enable?.();
          // UX: no rotation (Airbnb-like)
          mapRef.current.dragRotate?.disable?.();
          mapRef.current.touchZoomRotate?.disableRotation?.();
        } catch {
          // ignore
        }
        // Force resize after first paint (common when containers are flex/grid)
        setTimeout(() => {
          try {
            mapRef.current?.resize?.();
            mapRef.current?.triggerRepaint?.();
          } catch {
            // ignore
          }
        }, 0);
        setTimeout(() => {
          try {
            mapRef.current?.resize?.();
            mapRef.current?.triggerRepaint?.();
          } catch {
            // ignore
          }
        }, 250);
        setTimeout(() => {
          try {
            // Some Firefox setups need an explicit repaint after layout settles.
            mapRef.current?.triggerRepaint?.();
          } catch {
            // ignore
          }
        }, 800);
      });
      mapRef.current.on("error", (e: any) => {
        const msg =
          e?.error?.message ||
          e?.error?.status ||
          e?.type ||
          "Mapbox error";
        setMapError(String(msg));
        try {
          const status = e?.error?.status ? ` status=${e.error.status}` : "";
          const url = e?.error?.url ? ` url=${e.error.url}` : "";
          setMapDebug(`map.error:${String(msg)}${status}${url}`);
        } catch {
          // ignore
        }

        // If the basemap/style requests keep failing (CSP/DNS/adblock), switch to OSM raster so the map renders.
        try {
          const url = String(e?.error?.url || "");
          const status = Number(e?.error?.status || 0);
          const isMapbox =
            url.includes("api.mapbox.com/styles") ||
            url.includes("api.mapbox.com/v4") ||
            url.includes("tiles.mapbox.com") ||
            url.includes("events.mapbox.com");
          if (!forceOsmBase && isMapbox && (status === 401 || status === 403 || status === 404 || status === 0)) {
            setForceOsmBase(true);
          }
        } catch {
          // ignore
        }
      });
    } else {
      mapRef.current.setCenter([center.lng, center.lat]);
      if (forceOsmBase) {
        try {
          const style = mapRef.current.getStyle?.();
          const hasOsm = Boolean(style?.sources?.osm);
          if (!hasOsm) mapRef.current.setStyle?.(osmStyle as any);
        } catch {
          // ignore
        }
      }
      try {
        mapRef.current.resize?.();
      } catch {
        // ignore
      }
    }
  }, [ready, center.lat, center.lng, accessToken, forceOsmBase]);

  const takeSnapshot = () => {
    try {
      const map = mapRef.current;
      if (!map) return;
      const canvas = map.getCanvas?.();
      if (!canvas) return;
      const url = canvas.toDataURL?.("image/png");
      if (typeof url === "string" && url.startsWith("data:image")) setSnapshotUrl(url);
      else setMapDebug("snapshot-failed");
    } catch (e: any) {
      setMapDebug(`snapshot-error:${String(e?.message || e)}`);
    }
  };

  useEffect(() => {
    // Cleanup only on unmount.
    return () => {
      try {
        resizeObserverRef.current?.disconnect?.();
      } catch {
        // ignore
      }
      resizeObserverRef.current = null;
      try {
        mapRef.current?.remove?.();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!mapLoaded) return;
    if (!mapRef.current) return;
    if (!window.mapboxgl) return;

    const map = mapRef.current;
    const geojson = {
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          score: p.score01,
          submarket: p.submarket,
          marketScore: p.marketScore,
          adr: p.adr,
          occupancy: p.occupancy,
          revenueMonthly: p.revenueMonthly,
          competitors: p.competitors,
          demandLabel: p.demandLabel
        }
      }))
    };

    const onMove = (e: any) => {
      if (!e?.features?.length) return;
      const f = e.features[0];
      const submarket = String(f?.properties?.submarket || "Submarket");
      const marketScore = Number(f?.properties?.marketScore);
      const adr = Number(f?.properties?.adr);
      const occupancy = Number(f?.properties?.occupancy);
      const revenueMonthly = Number(f?.properties?.revenueMonthly);
      const competitors = Number(f?.properties?.competitors);
      const demandLabel = String(f?.properties?.demandLabel || "Medium");
      const html = `
        <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height: 1.35;">
          <div style="font-weight: 800; margin-bottom: 4px;">${submarket}</div>
          <div style="opacity: 0.75; margin-bottom: 6px;">${zoneLabel}</div>
          <div style="margin-top: 6px;">
            <span style="font-weight: 700;">Market Score:</span> ${marketScore}
          </div>
          <div style="margin-top: 6px; opacity: 0.95;">
            <div><span style="font-weight: 700;">ADR:</span> $${Math.round(adr)}</div>
            <div><span style="font-weight: 700;">Occupancy:</span> ${Math.round(occupancy * 100)}%</div>
            <div><span style="font-weight: 700;">Estimated revenue:</span> $${Math.round(revenueMonthly).toLocaleString()}/mo</div>
            <div><span style="font-weight: 700;">Competitors:</span> ${competitors}</div>
            <div><span style="font-weight: 700;">Demand:</span> ${demandLabel}</div>
          </div>
        </div>
      `;
      popupRef.current?.setLngLat(e.lngLat).setHTML(html).addTo(map);
    };

    const onLeave = () => {
      try {
        popupRef.current?.remove();
      } catch {
        // ignore
      }
    };

    // Show tooltip even if the cursor is near a point (not exactly over the tiny circle).
    const onMapMove = (e: any) => {
      try {
        const buffer = 18;
        const p = e.point;
        const bbox: [[number, number], [number, number]] = [
          [p.x - buffer, p.y - buffer],
          [p.x + buffer, p.y + buffer]
        ];
        const feats = map.queryRenderedFeatures(bbox, { layers: [pointsLayerId] }) || [];
        if (!feats.length) {
          onLeave();
          return;
        }
        onMove({ ...e, features: feats });
      } catch {
        // ignore
      }
    };

    function upsert() {
      setOverlayReady(false);
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: geojson });
      } else {
        map.getSource(sourceId).setData(geojson);
      }

      if (!map.getLayer(heatLayerId)) {
        map.addLayer({
          id: heatLayerId,
          type: "heatmap",
          source: sourceId,
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "score"], 0, 0.2, 1, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 14, 1.7],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 16, 13, 34, 15, 56],
            "heatmap-opacity": 0.70,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,0,0)",
              0.15,
              "#ff3b30",
              0.45,
              "#ff9500",
              0.70,
              "#ffcc00",
              1,
              "#34c759"
            ]
          }
        });
      }

      if (!map.getLayer(pointsLayerId)) {
        // Small visible points for "realistic scattered data" feel + hover target.
        map.addLayer({
          id: pointsLayerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 14, 7],
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "score"],
              0,
              "#ff3b30",
              0.35,
              "#ff9500",
              0.6,
              "#ffcc00",
              1,
              "#34c759"
            ],
            "circle-opacity": 0.70,
            "circle-stroke-color": "rgba(0,0,0,0.20)",
            "circle-stroke-width": 1
          }
        });
      }

      // (re)bind hover handlers (setStyle resets layers/handlers expectations)
      try {
        map.off("mousemove", pointsLayerId, onMove);
        map.off("mouseleave", pointsLayerId, onLeave);
        map.off("mousemove", onMapMove);
      } catch {
        // ignore
      }
      map.on("mousemove", pointsLayerId, onMove);
      map.on("mouseleave", pointsLayerId, onLeave);
      map.on("mousemove", onMapMove);
      map.on("click", pointsLayerId, (e: any) => {
        try {
          const f = e?.features?.[0];
          if (!f) return;
          const id = String(f.properties?.id || "");
          const p = points.find((x) => x.id === id) || null;
          setSelectedPoint(p);
        } catch {
          // ignore
        }
      });
      setOverlayReady(true);
    }

    if (map.loaded()) upsert();
    else map.once("load", upsert);

    return () => {
      try {
        map.off("mousemove", pointsLayerId, onMove);
        map.off("mouseleave", pointsLayerId, onLeave);
        map.off("mousemove", onMapMove);
      } catch {
        // ignore
      }
    };
  }, [ready, mapLoaded, points, zoneLabel, base.adr, base.occupancy, base.competitors]);

  if (!accessToken) {
    return (
      <Box
        sx={{
          height: "100%",
          minHeight: 520,
          borderRadius: 2,
          border: "1px dashed",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3
        }}
      >
        <Stack spacing={1} alignItems="center">
          <Typography sx={{ fontWeight: 800 }}>Mapbox access token required</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 420 }}>
            Set <code>VITE_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to enable the map and the commercial potential overlay.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        height: "100%",
        minHeight: 520,
        // Keep overlays/chips un-clipped; the map itself is clipped inside an inner wrapper.
        overflow: "visible",
        bgcolor: "transparent"
      }}
    >
      {/* Visual chrome (rounded border) without covering the WebGL canvas */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.02) inset",
          pointerEvents: "none",
          zIndex: 1
        }}
      />
      {/* Clip only the map area (not the chips/overlays) */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          borderRadius: 2,
          overflow: "hidden"
        }}
      >
        {renderMode === "image" && frameUrl ? (
          <Box
            component="img"
            src={frameUrl}
            alt="Map"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
              pointerEvents: "none"
            }}
          />
        ) : null}
      <Box
        ref={mapEl}
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          // Firefox: WebGL canvases can fail to composite under some stacking contexts.
          // Force a compositor layer on the container instead of using `isolation`.
          isolation: "auto",
          transform: "translate3d(0,0,0)",
          willChange: "transform",
          backfaceVisibility: "hidden",
          // Another nudge for some Firefox/GPU combos
          // (keep filter off by default to avoid unexpected effects)
          filter: "none"
        }}
      />
      </Box>
      <Box
        sx={{
          position: "absolute",
          left: 12,
          top: 12,
          zIndex: 2,
          bgcolor: "rgba(255,255,255,0.92)",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          px: 1.25,
          py: 0.75,
          display: "flex",
          gap: 1,
          alignItems: "center"
        }}
      >
        <Chip size="small" label="Potential" />
        <Chip size="small" variant="outlined" label={mapLoaded ? "Map: ready" : ready ? "Map: loading" : "Map: init"} sx={{ height: 22 }} />
        <Chip size="small" variant="outlined" label={overlayReady ? `Overlay: ${points.length} pts` : "Overlay: loading"} sx={{ height: 22 }} />
        <Chip
          size="small"
          variant="outlined"
          label={renderMode === "image" ? "Render: image" : "Render: live"}
          onClick={() => setRenderMode((m) => (m === "image" ? "live" : "image"))}
          sx={{ height: 22, cursor: "pointer" }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={mapHealth}
          sx={{ height: 22, maxWidth: 320, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={paintProbe || "probe…"}
          sx={{ height: 22, maxWidth: 380, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={webglLost ? "WebGL: lost" : "Snapshot"}
          onClick={webglLost ? undefined : takeSnapshot}
          sx={{ height: 22, cursor: webglLost ? "default" : "pointer" }}
        />
      </Box>
      {!ready ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.paper"
          }}
        >
          <Stack spacing={1} alignItems="center">
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Loading map…
            </Typography>
          </Stack>
        </Box>
      ) : null}
      {mapError ? (
        <Box
          sx={{
            position: "absolute",
            left: 12,
            bottom: 12,
            right: 12,
            bgcolor: "rgba(255,255,255,0.92)",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            px: 1.25,
            py: 1
          }}
        >
          <Typography variant="caption" color="error" sx={{ fontWeight: 700 }}>
            Map error: {mapError}
          </Typography>
        </Box>
      ) : null}
      {mapDebug ? (
        <Box
          sx={{
            position: "absolute",
            left: 12,
            bottom: mapError ? 56 : 12,
            right: 12,
            bgcolor: "rgba(255,255,255,0.92)",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            px: 1.25,
            py: 1
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {mapDebug}
          </Typography>
        </Box>
      ) : null}
      {snapshotUrl ? (
        <Box
          sx={{
            position: "absolute",
            inset: 12,
            zIndex: 3,
            bgcolor: "rgba(255,255,255,0.96)",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              Canvas snapshot (debug)
            </Typography>
            <Button size="small" variant="outlined" onClick={() => setSnapshotUrl(null)}>
              Close
            </Button>
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", borderRadius: 1 }}>
            <Box component="img" src={snapshotUrl} alt="Map snapshot" sx={{ width: "100%", display: "block" }} />
          </Box>
        </Box>
      ) : null}

      <Dialog open={Boolean(selectedPoint)} onClose={() => setSelectedPoint(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Submarket detail</DialogTitle>
        <DialogContent dividers>
          {selectedPoint ? (
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 800 }}>{selectedPoint.submarket}</Typography>
              <Typography variant="body2" color="text.secondary">
                {zoneLabel}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Market score
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {selectedPoint.marketScore}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Demand
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {selectedPoint.demandLabel}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        ADR
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        ${Math.round(selectedPoint.adr)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Occupancy
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {Math.round(selectedPoint.occupancy * 100)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Estimated monthly revenue
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        ${Math.round(selectedPoint.revenueMonthly).toLocaleString()}/mo
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Competitors: {selectedPoint.competitors}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" onClick={() => (window.location.href = "/competitive-set")}>
                  View Competitive Set
                </Button>
                <Button variant="outlined" onClick={() => (window.location.href = "/revenue-optimizer")}>
                  Create Revenue Optimizer
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPoint(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function MarketIntelligence() {
  const token = useMemo(() => getAccessToken(), []);
  const [error, setError] = useState<string | null>(null);

  const [assets, setAssets] = useState<{ id: string; name: string; asset_type: string }[]>([]);
  const propertyAssets = useMemo(() => assets.filter((a) => a.asset_type === "property"), [assets]);
  const [assetId, setAssetId] = useState<string>("");

  const [zone, setZone] = useState("Brickell, Miami");
  const [propertyType, setPropertyType] = useState("Apartment");
  const [bedrooms, setBedrooms] = useState(2);
  const [guests, setGuests] = useState(4);
  const [horizon, setHorizon] = useState(90);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!token) {
      setError("Missing session token. Go to Login.");
      return;
    }
    listAssets(token)
      .then((d) => {
        const items = (d.items || []) as { id: string; name: string; asset_type: string }[];
        setAssets(items);
        const firstProp = items.find((a) => a.asset_type === "property");
        setAssetId((v) => v || firstProp?.id || "");
      })
      .catch((e) => setError(e.message || String(e)));
  }, [token]);

  const seed = useMemo(
    () => hashSeed(`${assetId}|${zone}|${propertyType}|${bedrooms}|${guests}|${horizon}`),
    [assetId, zone, propertyType, bedrooms, guests, horizon]
  );
  const rnd = useMemo(() => mulberry32(seed), [seed]);

  const kpis = useMemo(() => {
    const marketScore = clamp(62 + Math.round(rnd() * 30) + bedrooms * 2 - Math.max(0, guests - 4), 0, 100);
    const occupancy = clamp(0.48 + rnd() * 0.32 + bedrooms * 0.02, 0.25, 0.92);
    const adr = clamp(72 + rnd() * 85 + bedrooms * 12 + (propertyType === "Casa" ? 18 : 0), 55, 320);
    const monthlyRevenue = Math.round(adr * occupancy * 30);
    const annualRevenue = Math.round(monthlyRevenue * 12 * (0.92 + rnd() * 0.12));
    const competitors = Math.round(120 + rnd() * 420);
    return { marketScore, occupancy, adr, monthlyRevenue, annualRevenue, competitors };
  }, [rnd, bedrooms, guests, propertyType]);

  const series = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => dayjs().startOf("month").add(i, "month"));
    const labels = months.map((m) => m.format("MMM"));
    const baseOcc = kpis.occupancy;
    const baseAdr = kpis.adr;
    const occ = months.map((m, idx) => {
      const season = 0.09 * Math.sin(((idx + 1) / 12) * Math.PI * 2) + 0.06 * Math.cos(((idx + 2) / 12) * Math.PI * 2);
      const noise = (rnd() - 0.5) * 0.05;
      return clamp(baseOcc + season + noise, 0.2, 0.95);
    });
    const adr = months.map((_, idx) => {
      const season = 0.12 * Math.sin(((idx + 2) / 12) * Math.PI * 2);
      const noise = (rnd() - 0.5) * 0.08;
      return clamp(baseAdr * (1 + season + noise), 50, 420);
    });
    const revenue = months.map((_, i) => Math.round(adr[i] * occ[i] * 30));
    return { labels, occ, adr, revenue };
  }, [rnd, kpis.occupancy, kpis.adr]);

  const events = useMemo(() => {
    const start = dayjs().startOf("day");
    const candidates = [
      { name: "Major concert / venue", impact: "High" as const },
      { name: "Convention / hotel compression", impact: "Medium" as const },
      { name: "Sports game / arena", impact: "Medium" as const },
      { name: "Holiday", impact: "High" as const },
      { name: "Corporate event", impact: "Low" as const }
    ];
    return Array.from({ length: 6 }, (_, i) => {
      const c = candidates[Math.floor(rnd() * candidates.length)];
      const d = start.add(Math.floor(rnd() * horizon), "day").add(i * 3, "day");
      return { id: `${i}-${d.format("YYYYMMDD")}`, date: d, ...c };
    }).sort((a, b) => a.date.valueOf() - b.date.valueOf());
  }, [rnd, horizon]);

  const subzones = useMemo(() => {
    const names = [
      "Brickell Key",
      "Mary Brickell Village",
      "Downtown Core",
      "Design District",
      "Wynwood Arts District",
      "Edgewater Bayfront",
      "Mid-Beach"
    ];
    return names
      .map((name) => {
        const score = clamp(55 + Math.round(rnd() * 40), 0, 100);
        const occ = clamp(0.35 + rnd() * 0.45, 0.15, 0.95);
        const adr = clamp(65 + rnd() * 120, 50, 350);
        return { name, score, occ, adr, revenue: Math.round(adr * occ * 30) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [rnd]);

  const heat = useMemo(() => {
    const centers: Record<string, { lat: number; lng: number }> = {
      "Brickell, Miami": { lat: 25.7624, lng: -80.1901 },
      "Downtown Miami": { lat: 25.7752, lng: -80.1889 },
      "Wynwood, Miami": { lat: 25.8015, lng: -80.1994 },
      "Edgewater, Miami": { lat: 25.7954, lng: -80.1869 },
      "Miami Beach (South Beach)": { lat: 25.7826, lng: -80.1341 },
      "Coconut Grove, Miami": { lat: 25.7289, lng: -80.2426 },
      "Biscayne Bay (Miami)": { lat: 25.7839, lng: -80.1797 }
    };
    const center = centers[zone] || centers["Brickell, Miami"];

    // Scattered points (multi-cluster) to mimic real listing/geodata density.
    const clusters = [
      { name: "Core", dLat: 0.0, dLng: 0.0, spread: 0.010, weight: 0.45 },
      { name: "Waterfront", dLat: 0.006, dLng: 0.010, spread: 0.012, weight: 0.25 },
      { name: "Residential", dLat: -0.008, dLng: -0.010, spread: 0.014, weight: 0.20 },
      { name: "Transit", dLat: 0.010, dLng: -0.006, spread: 0.010, weight: 0.10 }
    ];

    function pickCluster() {
      const x = rnd();
      let acc = 0;
      for (const c of clusters) {
        acc += c.weight;
        if (x <= acc) return c;
      }
      return clusters[0];
    }

    // Box-Muller for roughly-normal scatter.
    function randn() {
      let u = 0;
      let v = 0;
      while (u === 0) u = rnd();
      while (v === 0) v = rnd();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    const points: HeatPoint[] = [];
    const total = 10;
    for (let i = 0; i < total; i++) {
      const c = pickCluster();
      const lat = center.lat + c.dLat + randn() * c.spread;
      const lng = center.lng + c.dLng + randn() * c.spread;
      const dist = Math.sqrt(Math.pow((lat - center.lat) / 0.01, 2) + Math.pow((lng - center.lng) / 0.01, 2));
      const baseScore = clamp(0.85 - dist * 0.18 + (rnd() - 0.5) * 0.22, 0, 1);

      const marketScore = clamp(Math.round(55 + baseScore * 45 + rnd() * 6), 0, 100);
      const adr = clamp(Math.round(kpis.adr * (0.82 + baseScore * 0.45)), 45, 650);
      const occupancy = clamp(kpis.occupancy * (0.78 + baseScore * 0.45), 0.15, 0.95);
      const revenueMonthly = Math.round(adr * occupancy * 30);
      const competitors = Math.max(6, Math.round(kpis.competitors * (0.25 + baseScore * 0.18)));
      const demandLabel: HeatPoint["demandLabel"] = baseScore >= 0.72 ? "High" : baseScore >= 0.48 ? "Medium" : "Low";

      points.push({
        id: `p-${i}`,
        lat,
        lng,
        score01: baseScore,
        submarket: `${c.name} area`,
        marketScore,
        adr,
        occupancy,
        revenueMonthly,
        competitors,
        demandLabel
      });
    }

    return { center, points };
  }, [rnd]);

  const conclusion = useMemo(() => {
    const reasons: string[] = [];
    if (kpis.occupancy >= 0.68) reasons.push("high occupancy");
    if (kpis.adr >= 140) reasons.push("strong ADR");
    if (kpis.competitors <= 220) reasons.push("manageable competition");
    if (events.some((e) => e.impact === "High")) reasons.push("upcoming high-impact events");
    if (kpis.annualRevenue >= 20000) reasons.push("above-average projected revenue");
    return reasons.length
      ? `This market looks attractive because it combines: ${reasons.join(", ")}.`
      : "More data is needed for a confident conclusion (mixed signals).";
  }, [kpis.occupancy, kpis.adr, kpis.competitors, kpis.annualRevenue, events]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Market Intelligence
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Evaluate market opportunity for STR / mid-term stays and investment.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Chip label={`Horizon: next ${horizon} days`} />
              <Chip label={`${bedrooms} bd • ${guests} guests`} />
              <Chip label={propertyType} />
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {!propertyAssets.length ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No real estate assets found. Market Intelligence is enabled only for <strong>property</strong> assets.
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth disabled={!propertyAssets.length}>
                <InputLabel id="asset-label">Property</InputLabel>
                <Select
                  labelId="asset-label"
                  value={assetId}
                  label="Property"
                  onChange={(e) => setAssetId(String(e.target.value))}
                >
                  {propertyAssets.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="zone-label">Market / Neighborhood</InputLabel>
                <Select
                  labelId="zone-label"
                  value={zone}
                  label="Market / Neighborhood"
                  onChange={(e) => setZone(String(e.target.value))}
                >
                  <MenuItem value="Brickell, Miami">Brickell, Miami</MenuItem>
                  <MenuItem value="Downtown Miami">Downtown Miami</MenuItem>
                  <MenuItem value="Wynwood, Miami">Wynwood, Miami</MenuItem>
                  <MenuItem value="Edgewater, Miami">Edgewater, Miami</MenuItem>
                  <MenuItem value="Miami Beach (South Beach)">Miami Beach (South Beach)</MenuItem>
                  <MenuItem value="Coconut Grove, Miami">Coconut Grove, Miami</MenuItem>
                  <MenuItem value="Biscayne Bay (Miami)">Biscayne Bay (Miami)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="ptype-label">Property Type</InputLabel>
                <Select
                  labelId="ptype-label"
                  value={propertyType}
                  label="Property Type"
                  onChange={(e) => setPropertyType(String(e.target.value))}
                >
                  <MenuItem value="Apartment">Apartment</MenuItem>
                  <MenuItem value="House">House</MenuItem>
                  <MenuItem value="Studio">Studio</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                label="Bedrooms"
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(clamp(Number(e.target.value || 0), 0, 10))}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                label="Guests"
                type="number"
                value={guests}
                onChange={(e) => setGuests(clamp(Number(e.target.value || 0), 1, 20))}
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <FormControl fullWidth>
                <InputLabel id="horizon-label">Days</InputLabel>
                <Select
                  labelId="horizon-label"
                  value={horizon}
                  label="Days"
                  onChange={(e) => setHorizon(Number(e.target.value))}
                >
                  <MenuItem value={30}>30</MenuItem>
                  <MenuItem value={60}>60</MenuItem>
                  <MenuItem value={90}>90</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: "100%", overflow: "visible" }}>
            <CardContent sx={{ overflow: "visible" }}>
              <Typography sx={{ fontWeight: 800 }}>Map (quality / commercial potential)</Typography>
              <Typography variant="body2" color="text.secondary">
                Explore neighborhoods; hover to see score.
              </Typography>
              <Box sx={{ mt: 2 }}>
                <LeafletZoneHeatMap
                  center={heat.center}
                  points={heat.points}
                  zoneLabel={zone}
                  base={{ adr: kpis.adr, occupancy: kpis.occupancy, competitors: kpis.competitors }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Tabs value={tab} onChange={(_, v) => setTab(Number(v))} variant="scrollable" scrollButtons="auto">
                <Tab label="KPIs" />
                <Tab label="Trends" />
                <Tab label="Events" />
                <Tab label="Submarkets" />
                <Tab label="Summary" />
              </Tabs>

              <TabPanel value={tab} index={0}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Market Score
                        </Typography>
                        <Stack direction="row" alignItems="baseline" spacing={1}>
                          <Typography variant="h4" sx={{ fontWeight: 900 }}>
                            {kpis.marketScore}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            / 100
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Demand, competition, ADR, and internal signals.
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Estimated Occupancy
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900 }}>
                          {fmtPct(kpis.occupancy)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Next {horizon} days (model).
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Average ADR
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900 }}>
                          {fmtMoney(kpis.adr)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Estimated average nightly rate.
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Estimated monthly revenue
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900 }}>
                          {fmtMoney(kpis.monthlyRevenue)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total competition: {kpis.competitors.toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Chip label={`Estimated annual revenue: ${fmtMoney(kpis.annualRevenue)}`} />
                      <Chip
                        label={`Forecast 30/60/90: ${fmtMoney(Math.round(kpis.monthlyRevenue))} / ${fmtMoney(
                          Math.round(kpis.monthlyRevenue * 2)
                        )} / ${fmtMoney(Math.round(kpis.monthlyRevenue * 3))}`}
                      />
                    </Stack>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tab} index={1}>
                <Stack spacing={2}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography sx={{ fontWeight: 800 }}>Historical demand / seasonality</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Estimated occupancy by month (proxy).
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <LineChart
                          height={240}
                          series={[{ data: series.occ.map((v) => Math.round(v * 100)), label: "Occupancy %" }]}
                          xAxis={[{ data: series.labels, scaleType: "point" }]}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography sx={{ fontWeight: 800 }}>ADR trend</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Average daily rate trend by month (proxy).
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <LineChart
                          height={240}
                          series={[{ data: series.adr.map((v) => Math.round(v)), label: "ADR ($)" }]}
                          xAxis={[{ data: series.labels, scaleType: "point" }]}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography sx={{ fontWeight: 800 }}>Revenue forecast</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Monthly projection (proxy) for 12 months.
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <BarChart
                          height={240}
                          series={[{ data: series.revenue, label: "Revenue ($)" }]}
                          xAxis={[{ data: series.labels, scaleType: "band" }]}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Stack>
              </TabPanel>

              <TabPanel value={tab} index={2}>
                <Typography sx={{ fontWeight: 800 }}>Local events</Typography>
                <Typography variant="body2" color="text.secondary">
                  Demand spike signals.
                </Typography>
                <List dense sx={{ mt: 1 }}>
                  {events.map((e) => (
                    <ListItem
                      key={e.id}
                      secondaryAction={
                        <Chip
                          size="small"
                          label={e.impact}
                          color={e.impact === "High" ? "success" : e.impact === "Medium" ? "warning" : "default"}
                        />
                      }
                    >
                      <ListItemText primary={e.name} secondary={e.date.format("ddd, D MMM YYYY")} />
                    </ListItem>
                  ))}
                </List>
              </TabPanel>

              <TabPanel value={tab} index={3}>
                <Typography sx={{ fontWeight: 800 }}>Submarket ranking</Typography>
                <Typography variant="body2" color="text.secondary">
                  Top nearby submarkets (proxy).
                </Typography>
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Submarket</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell align="right">Occ</TableCell>
                      <TableCell align="right">ADR</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subzones.map((z) => (
                      <TableRow key={z.name} hover>
                        <TableCell>{z.name}</TableCell>
                        <TableCell align="right">{z.score}</TableCell>
                        <TableCell align="right">{fmtPct(z.occ)}</TableCell>
                        <TableCell align="right">{fmtMoney(z.adr)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabPanel>

              <TabPanel value={tab} index={4}>
                <Typography sx={{ fontWeight: 800 }}>Summary</Typography>
                <Alert severity={kpis.marketScore >= 75 ? "success" : kpis.marketScore >= 62 ? "info" : "warning"} sx={{ mt: 2 }}>
                  {conclusion}
                </Alert>
                {/* <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Note: these numbers are UI placeholders; once Airbnb/Amadeus/Zillow/CRM are connected, they become real.
                </Typography> */}
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
