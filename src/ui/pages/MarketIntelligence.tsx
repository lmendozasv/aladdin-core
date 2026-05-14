import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Chip,
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

type HeatPoint = { id: string; lat: number; lng: number; score01: number; label: string };

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
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const accessTokenRaw = (import.meta as any).env?.VITE_PUBLIC_MAPBOX_ACCESS_TOKEN as string | undefined;
  const accessToken = accessTokenRaw?.trim();
  const sourceId = "mi-heat-src";
  const heatLayerId = "mi-heat-heat";
  const pointsLayerId = "mi-heat-points";
  const [mapLoaded, setMapLoaded] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);

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

    if (!mapRef.current) {
      window.mapboxgl.accessToken = accessToken;
      const mapboxStyleUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${encodeURIComponent(accessToken)}`;
      mapRef.current = new window.mapboxgl.Map({
        container: mapEl.current,
        style: mapboxStyleUrl,
        center: [center.lng, center.lat],
        zoom: 12.6,
        pitch: 0,
        attributionControl: false,
        antialias: true
      });
      popupRef.current = new window.mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "260px" });
      mapRef.current.addControl(new window.mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      mapRef.current.addControl(new window.mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      mapRef.current.on("load", () => {
        setMapLoaded(true);
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
      });
    } else {
      mapRef.current.setCenter([center.lng, center.lat]);
      try {
        mapRef.current.resize?.();
      } catch {
        // ignore
      }
    }
  }, [ready, center.lat, center.lng, accessToken]);

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
        properties: { id: p.id, score: p.score01, label: p.label }
      }))
    };

    const onMove = (e: any) => {
      if (!e?.features?.length) return;
      const f = e.features[0];
      const score = Number(f?.properties?.score);
      const label = String(f?.properties?.label || "");
      const estOcc = clamp(base.occupancy * (0.85 + score * 0.35), 0.15, 0.95);
      const estAdr = clamp(base.adr * (0.80 + score * 0.50), 45, 650);
      const estRev = Math.round(estAdr * estOcc * 30);
      const html = `
        <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height: 1.35;">
          <div style="font-weight: 800; margin-bottom: 4px;">${zoneLabel}</div>
          <div style="opacity: 0.8;">${label}</div>
          <div style="margin-top: 6px;">
            <span style="font-weight: 700;">Commercial Potential:</span> ${Math.round(score * 100)}/100
          </div>
          <div style="margin-top: 6px; opacity: 0.95;">
            <div><span style="font-weight: 700;">Est. Occupancy:</span> ${Math.round(estOcc * 100)}%</div>
            <div><span style="font-weight: 700;">Est. ADR:</span> $${Math.round(estAdr)}</div>
            <div><span style="font-weight: 700;">Est. Monthly Revenue:</span> $${estRev.toLocaleString()}</div>
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
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 4],
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
      } catch {
        // ignore
      }
      map.on("mousemove", pointsLayerId, onMove);
      map.on("mouseleave", pointsLayerId, onLeave);
      setOverlayReady(true);
    }

    if (map.loaded()) upsert();
    else map.once("load", upsert);

    return () => {
      try {
        map.off("mousemove", pointsLayerId, onMove);
        map.off("mouseleave", pointsLayerId, onLeave);
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
        // Avoid clipping WebGL canvas (Firefox can render blank under borderRadius/overflow hidden)
        overflow: "visible",
        bgcolor: "transparent"
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: 2,
          overflow: "hidden",
          pointerEvents: "none",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "hsl(210 30% 96%)",
          zIndex: 3
        }}
      />
      <Box
        ref={mapEl}
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          isolation: "isolate"
        }}
      />
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
    const total = 140;
    for (let i = 0; i < total; i++) {
      const c = pickCluster();
      const lat = center.lat + c.dLat + randn() * c.spread;
      const lng = center.lng + c.dLng + randn() * c.spread;
      const dist = Math.sqrt(Math.pow((lat - center.lat) / 0.01, 2) + Math.pow((lng - center.lng) / 0.01, 2));
      const baseScore = clamp(0.85 - dist * 0.18 + (rnd() - 0.5) * 0.22, 0, 1);
      points.push({
        id: `p-${i}`,
        lat,
        lng,
        score01: baseScore,
        label: `${c.name} area`
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
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography sx={{ fontWeight: 800 }}>Map (quality / commercial potential)</Typography>
              <Typography variant="body2" color="text.secondary">
                Explore neighborhoods; hover to see score.
              </Typography>
              <Box sx={{ mt: 2 }}>
                <ZoneHeatMap
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Note: these numbers are UI placeholders; once Airbnb/Amadeus/Zillow/CRM are connected, they become real.
                </Typography>
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
