import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import dayjs from "dayjs";
import { ScatterChart } from "@mui/x-charts/ScatterChart";
import { listAssets } from "../../api/core";
import { getAccessToken } from "../../state/session";

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

function fmtMoney(v: number) {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number) {
  return `${Math.round(v * 100)}%`;
}

type Comp = {
  id: string;
  name: string;
  distanceKm: number;
  similarity: number;
  adr: number;
  occupancy: number;
  rating: number;
  reviews: number;
  missingAmenities: string[];
  advantageAmenities: string[];
};

function buildMonthGrid(monthStart: dayjs.Dayjs) {
  const first = monthStart.startOf("month");
  const dayOfWeek = first.day(); // 0 Sun
  const gridStart = first.subtract(dayOfWeek, "day");
  return Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));
}

export default function CompetitiveSet() {
  const token = useMemo(() => getAccessToken(), []);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<{ id: string; name: string; asset_type: string }[]>([]);
  const propertyAssets = useMemo(() => assets.filter((a) => a.asset_type === "property"), [assets]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [month, setMonth] = useState(dayjs().startOf("month").format("YYYY-MM"));
  const [openCompId, setOpenCompId] = useState<string | null>(null);

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
        setPropertyId((v) => v || firstProp?.id || "");
      })
      .catch((e) => setError(e.message || String(e)));
  }, [token]);

  const seed = useMemo(() => hashSeed(`${propertyId}|${month}`), [propertyId, month]);
  const rnd = useMemo(() => mulberry32(seed), [seed]);

  const property = useMemo(() => {
    const a = propertyAssets.find((x) => x.id === propertyId);
    const baseSeed = hashSeed(`${propertyId}|base`);
    const rr = mulberry32(baseSeed);
    const adr = clamp(110 + rr() * 120, 70, 420);
    const rating = clamp(4.25 + rr() * 0.65, 3.7, 5.0);
    const reviews = Math.round(12 + rr() * 180);
    const minNights = rr() < 0.35 ? 3 : rr() < 0.75 ? 2 : 1;
    return { id: propertyId, name: a?.name || "Selected Property", adr, rating, reviews, minNights };
  }, [propertyId, propertyAssets]);

  const comps = useMemo<Comp[]>(() => {
    const listingNames = [
      "Luxury Brickell 1BR • Skyline Views • Walk to Restaurants",
      "Modern 2BR in Downtown Miami • Near Kaseya Center",
      "Wynwood Loft • Art District • Fast Wi‑Fi",
      "Edgewater Bayfront Studio • Pool + Gym",
      "South Beach Retreat • Steps to Ocean Drive",
      "Coconut Grove Cottage • Quiet + Patio",
      "Brickell Key High‑Rise • Balcony + Bay View",
      "Design District Suite • Shops + Cafes",
      "Waterfront Condo • Biscayne Bay Views",
      "Brickell Business Stay • Workspace + Parking",
      "Downtown Loft • MetroMover Access",
      "Miami Beach Modern Studio • Sunset Harbor"
    ];
    const amenityPool = ["self check-in", "parking", "A/C", "workspace", "washer/dryer", "pool", "gym", "fast Wi‑Fi", "pet friendly"];
    const items: Comp[] = [];
    const total = 18;
    for (let i = 0; i < total; i++) {
      const similarity = clamp(0.55 + rnd() * 0.42 - i * 0.008, 0.1, 0.98);
      const adr = clamp(property.adr * (0.80 + rnd() * 0.55), 45, 360);
      const occupancy = clamp(0.42 + rnd() * 0.45, 0.15, 0.95);
      const rating = clamp(4.10 + rnd() * 0.85, 3.5, 5.0);
      const reviews = Math.round(8 + rnd() * 140);
      const distanceKm = Math.round((0.3 + rnd() * 4.2) * 10) / 10;
      const missing = amenityPool.filter(() => rnd() < 0.16).slice(0, 4);
      const advantage = amenityPool.filter(() => rnd() < 0.14).slice(0, 3);
      items.push({
        id: `comp-${i + 1}`,
        name: listingNames[i % listingNames.length],
        distanceKm,
        similarity,
        adr,
        occupancy,
        rating,
        reviews,
        missingAmenities: missing,
        advantageAmenities: advantage
      });
    }
    return items.sort((a, b) => b.similarity - a.similarity);
  }, [rnd, property.adr]);

  const directComps = useMemo(() => comps.slice(0, 7), [comps]);
  const market = useMemo(() => {
    const adr = directComps.reduce((s, c) => s + c.adr, 0) / Math.max(1, directComps.length);
    const occ = directComps.reduce((s, c) => s + c.occupancy, 0) / Math.max(1, directComps.length);
    const rating = directComps.reduce((s, c) => s + c.rating, 0) / Math.max(1, directComps.length);
    const reviews = Math.round(directComps.reduce((s, c) => s + c.reviews, 0) / Math.max(1, directComps.length));
    return { adr, occ, rating, reviews };
  }, [directComps]);

  const gaps = useMemo(() => {
    const pricingGapPct = (property.adr - market.adr) / Math.max(1, market.adr);
    const ratingGap = property.rating - market.rating;
    const reviewsGap = property.reviews - market.reviews;
    const occGap = (0.62 + rnd() * 0.20) - market.occ; // synthetic "your occupancy"
    const availabilityPct = clamp(0.34 + rnd() * 0.52, 0.05, 0.95);
    const rank = Math.max(1, Math.round((1 - clamp((property.rating - 4.0) / 1.0, 0, 1)) * directComps.length));
    return { pricingGapPct, ratingGap, reviewsGap, occGap, availabilityPct, rank };
  }, [market.adr, market.rating, market.reviews, market.occ, property.adr, property.rating, property.reviews, rnd, directComps.length]);

  const monthStart = useMemo(() => dayjs(`${month}-01`).startOf("month"), [month]);
  const calendar = useMemo(() => {
    const cells = buildMonthGrid(monthStart);
    const activeMonth = monthStart.month();
    const rows = cells.map((d) => {
      const isInMonth = d.month() === activeMonth;
      const base = property.adr * (d.day() === 5 || d.day() === 6 ? 1.12 : 1);
      const compAvg = market.adr * (d.day() === 5 || d.day() === 6 ? 1.08 : 1);
      const yourPrice = Math.round(clamp(base * (0.92 + rnd() * 0.18), 45, 420));
      const compPrice = Math.round(clamp(compAvg * (0.90 + rnd() * 0.20), 45, 420));
      const demand = clamp(0.35 + rnd() * 0.6 + (d.day() === 5 || d.day() === 6 ? 0.06 : 0), 0, 1);
      return { d, isInMonth, yourPrice, compPrice, demand };
    });
    return { cells: rows, size: 7 };
  }, [monthStart, market.adr, property.adr, rnd]);

  const openComp = useMemo(() => (openCompId ? comps.find((c) => c.id === openCompId) || null : null), [openCompId, comps]);

  const scatterData = useMemo(() => {
    const points = comps.map((c, i) => ({
      id: i,
      x: Math.round(c.adr),
      y: Math.round(c.occupancy * 100),
      z: Math.round(c.similarity * 100),
      label: c.name
    }));
    const you = { id: 999, x: property.adr, y: Math.round((market.occ + gaps.occGap) * 100), z: 100, label: "Your listing" };
    return { points, you };
  }, [comps, property.adr, market.occ, gaps.occGap]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (gaps.pricingGapPct > 0.06) recs.push("Lower weekday pricing to close the pricing gap.");
    if (gaps.ratingGap < -0.05) recs.push("Improve photos and description to increase CTR and rating.");
    if (property.minNights >= 3) recs.push("Reduce minimum nights on orphan gaps (e.g., 3 → 2).");
    const missingTop = directComps
      .flatMap((c) => c.advantageAmenities)
      .reduce<Record<string, number>>((m, a) => {
        m[a] = (m[a] || 0) + 1;
        return m;
      }, {});
    const topAmenity = Object.entries(missingTop).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topAmenity) recs.push(`Add / highlight this amenity: ${topAmenity}.`);
    return recs.slice(0, 5);
  }, [gaps.pricingGapPct, gaps.ratingGap, property.minNights, directComps]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Competitive Set
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Compare a listing against its closest competitors and identify gaps.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Chip label={`Current price: ${fmtMoney(property.adr)}/night`} />
              <Chip label={`Competitors: ${comps.length} (direct: ${directComps.length})`} />
              <Chip label="Window: next 90 days" />
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
              No real estate assets found. Competitive Set is enabled only for <strong>property</strong> assets.
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!propertyAssets.length}>
                <InputLabel id="prop-label">Property</InputLabel>
                <Select
                  labelId="prop-label"
                  label="Property"
                  value={propertyId}
                  onChange={(e) => setPropertyId(String(e.target.value))}
                >
                  {propertyAssets.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="month-label">Month</InputLabel>
                <Select labelId="month-label" label="Month" value={month} onChange={(e) => setMonth(String(e.target.value))}>
                  {Array.from({ length: 6 }, (_, i) => dayjs().startOf("month").add(i, "month").format("YYYY-MM")).map((m) => (
                    <MenuItem key={m} value={m}>
                      {dayjs(`${m}-01`).format("MMMM YYYY")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Relative rank
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    #{gaps.rank}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    within direct comp set
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                ADR vs market
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {gaps.pricingGapPct >= 0 ? "+" : ""}
                {Math.round(gaps.pricingGapPct * 100)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your ADR {fmtMoney(property.adr)} vs {fmtMoney(market.adr)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Occupancy vs comps
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {gaps.occGap >= 0 ? "+" : ""}
                {Math.round(gaps.occGap * 100)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Market: {fmtPct(market.occ)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Rating vs comps
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {gaps.ratingGap >= 0 ? "+" : ""}
                {gaps.ratingGap.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your rating {property.rating.toFixed(2)} vs {market.rating.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Disponibilidad
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {fmtPct(gaps.availabilityPct)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                available (estimate)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              <Typography sx={{ fontWeight: 800 }}>Competitor table</Typography>
              <Typography variant="body2" color="text.secondary">
                Sorted by similarity. Click to view gaps.
              </Typography>
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Listing</TableCell>
                    <TableCell align="right">Similitud</TableCell>
                    <TableCell align="right">Dist (km)</TableCell>
                    <TableCell align="right">ADR</TableCell>
                    <TableCell align="right">Occ</TableCell>
                    <TableCell align="right">Rating</TableCell>
                    <TableCell align="right">Reviews</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comps.map((c) => (
                    <TableRow key={c.id} hover onClick={() => setOpenCompId(c.id)} sx={{ cursor: "pointer" }}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell align="right">{Math.round(c.similarity * 100)}%</TableCell>
                      <TableCell align="right">{c.distanceKm}</TableCell>
                      <TableCell align="right">{fmtMoney(c.adr)}</TableCell>
                      <TableCell align="right">{fmtPct(c.occupancy)}</TableCell>
                      <TableCell align="right">{c.rating.toFixed(2)}</TableCell>
                      <TableCell align="right">{c.reviews}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => setOpenCompId(c.id)}>
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card>
            <CardContent>
              <Typography sx={{ fontWeight: 800 }}>Price vs occupancy</Typography>
              <Typography variant="body2" color="text.secondary">
                Each point represents a competitor (ADR vs Occupancy%).
              </Typography>
              <Box sx={{ mt: 2 }}>
                <ScatterChart
                  height={300}
                  series={[
                    { data: scatterData.points.map((p) => ({ x: p.x, y: p.y, id: p.id })), label: "Competitors" },
                    { data: [{ x: scatterData.you.x, y: scatterData.you.y, id: scatterData.you.id }], label: "Your listing" }
                  ]}
                  xAxis={[{ label: "ADR ($)" }]}
                  yAxis={[{ label: "Occupancy (%)" }]}
                />
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography sx={{ fontWeight: 800 }}>Recommendations</Typography>
              <List dense>
                {recommendations.map((r, idx) => (
                  <ListItem key={idx}>
                    <ListItemText primary={r} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography sx={{ fontWeight: 800 }}>Competitive calendar</Typography>
          <Typography variant="body2" color="text.secondary">
            Quick comparison (your price vs avg comps) + demand (shade).
          </Typography>
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 1
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <Typography key={d} variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                {d}
              </Typography>
            ))}
            {calendar.cells.map((c, idx) => {
              const diff = c.yourPrice - c.compPrice;
              const diffPct = diff / Math.max(1, c.compPrice);
              const bg = `hsl(210 40% ${92 - c.demand * 28}%)`;
              return (
                <Box
                  key={`${idx}-${c.d.format("YYYY-MM-DD")}`}
                  sx={{
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: c.isInMonth ? bg : "transparent",
                    p: 1,
                    minHeight: 66,
                    opacity: c.isInMonth ? 1 : 0.35
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {c.d.date()}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${diffPct >= 0 ? "+" : ""}${Math.round(diffPct * 100)}%`}
                      color={Math.abs(diffPct) >= 0.12 ? "warning" : "default"}
                      sx={{ height: 20 }}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    You {fmtMoney(c.yourPrice)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Comps {fmtMoney(c.compPrice)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Dialog open={Boolean(openComp)} onClose={() => setOpenCompId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{openComp?.name || "Listing"}</DialogTitle>
        <DialogContent dividers>
          {openComp ? (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Similaridad
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {Math.round(openComp.similarity * 100)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Distancia
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {openComp.distanceKm} km
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Divider />
              <Typography sx={{ fontWeight: 800 }}>Detected gaps</Typography>
              <Typography variant="body2" color="text.secondary">
                Amenities they have that you can add / highlight:
              </Typography>
              {openComp.advantageAmenities.length ? (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {openComp.advantageAmenities.map((a) => (
                    <Chip key={a} label={a} size="small" />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No clear advantages.
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Competitor weaknesses (opportunity):
              </Typography>
              {openComp.missingAmenities.length ? (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {openComp.missingAmenities.map((a) => (
                    <Chip key={a} label={a} size="small" variant="outlined" />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No clear weaknesses.
                </Typography>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCompId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
