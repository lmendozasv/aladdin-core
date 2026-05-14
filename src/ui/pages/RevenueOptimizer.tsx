import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import dayjs from "dayjs";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
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

function buildMonthGrid(monthStart: dayjs.Dayjs) {
  const first = monthStart.startOf("month");
  const dayOfWeek = first.day();
  const gridStart = first.subtract(dayOfWeek, "day");
  return Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));
}

export default function RevenueOptimizer() {
  const token = useMemo(() => getAccessToken(), []);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<{ id: string; name: string; asset_type: string }[]>([]);
  const propertyAssets = useMemo(() => assets.filter((a) => a.asset_type === "property"), [assets]);
  const [propertyId, setPropertyId] = useState<string>("");

  const [strategy, setStrategy] = useState<"Conservative" | "Balanced" | "Aggressive">("Balanced");
  const [aggressiveness, setAggressiveness] = useState(50);
  const [horizon, setHorizon] = useState(90);
  const [month, setMonth] = useState(dayjs().startOf("month").format("YYYY-MM"));

  const [minPrice, setMinPrice] = useState(70);
  const [basePrice, setBasePrice] = useState(110);
  const [maxPrice, setMaxPrice] = useState(260);

  const [openDay, setOpenDay] = useState<string | null>(null);

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

  const seed = useMemo(
    () => hashSeed(`${propertyId}|${strategy}|${aggressiveness}|${horizon}|${month}|${minPrice}|${basePrice}|${maxPrice}`),
    [propertyId, strategy, aggressiveness, horizon, month, minPrice, basePrice, maxPrice]
  );
  const rnd = useMemo(() => mulberry32(seed), [seed]);

  const derived = useMemo(() => {
    const stratBoost = strategy === "Aggressive" ? 1.10 : strategy === "Conservative" ? 0.94 : 1.0;
    const agg = aggressiveness / 100; // 0..1
    const occBase = clamp(0.52 + rnd() * 0.26 + (strategy === "Conservative" ? 0.05 : -0.02), 0.25, 0.92);
    const adrRecommended = clamp(basePrice * (0.92 + 0.18 * stratBoost + agg * 0.08), minPrice, maxPrice);
    const occRecommended = clamp(occBase + (strategy === "Aggressive" ? -0.04 : 0.02) + (0.5 - agg) * 0.03, 0.2, 0.92);
    const revenueActual = Math.round(basePrice * occBase * 30);
    const revenueOptimized = Math.round(adrRecommended * occRecommended * 30 * (1.02 + rnd() * 0.06));
    const pacing = clamp(0.35 + rnd() * 0.55, 0, 1);
    const vacancyRisk = clamp(1 - occRecommended + (strategy === "Aggressive" ? 0.08 : -0.03), 0, 1);
    return { adrRecommended, occRecommended, revenueActual, revenueOptimized, pacing, vacancyRisk };
  }, [strategy, aggressiveness, rnd, basePrice, minPrice, maxPrice]);

  const demandCurve = useMemo(() => {
    const steps = 16;
    const prices = Array.from({ length: steps }, (_, i) => Math.round(minPrice + (i / (steps - 1)) * (maxPrice - minPrice)));
    const a = 0.9 + rnd() * 0.25;
    const b = 0.012 + rnd() * 0.012;
    const demand = prices.map((p) => clamp(a * Math.exp(-b * (p - minPrice)), 0.05, 0.98));
    const expectedRevenue = prices.map((p, i) => Math.round(p * demand[i] * 30));
    const bestIdx = expectedRevenue.reduce((best, v, i) => (v > expectedRevenue[best] ? i : best), 0);
    const recommended = clamp(Math.round(derived.adrRecommended), minPrice, maxPrice);
    return { prices, demand, expectedRevenue, bestPrice: prices[bestIdx], recommended };
  }, [minPrice, maxPrice, rnd, derived.adrRecommended]);

  const forecast = useMemo(() => {
    const horizons = [30, 60, 90];
    const base = derived.revenueOptimized;
    const items = horizons.map((h) => {
      const scale = h / 30;
      const noise = 0.94 + rnd() * 0.14;
      return { h, value: Math.round(base * scale * noise) };
    });
    return items;
  }, [derived.revenueOptimized, rnd]);

  const monthStart = useMemo(() => dayjs(`${month}-01`).startOf("month"), [month]);
  const calendar = useMemo(() => {
    const activeMonth = monthStart.month();
    const cells = buildMonthGrid(monthStart).map((d) => {
      const isInMonth = d.month() === activeMonth;
      const isWeekend = d.day() === 5 || d.day() === 6;
      const season = 0.10 * Math.sin(((d.date() + d.month() * 3) / 31) * Math.PI * 2);
      const eventBoost = rnd() < 0.08 ? 0.10 + rnd() * 0.18 : 0;
      const demand = clamp(0.40 + rnd() * 0.48 + (isWeekend ? 0.08 : 0) + season + eventBoost, 0, 1);
      const price = clamp(
        Math.round(
          basePrice *
            (0.82 + demand * 0.55 + (aggressiveness / 100) * 0.08) *
            (strategy === "Aggressive" ? 1.04 : strategy === "Conservative" ? 0.97 : 1)
        ),
        minPrice,
        maxPrice
      );
      const occupancy = clamp(demand * (0.68 + rnd() * 0.25), 0, 1);
      return { d, isInMonth, demand, price, occupancy };
    });
    return { cells };
  }, [monthStart, rnd, basePrice, minPrice, maxPrice, aggressiveness, strategy]);

  const recommendations = useMemo(() => {
    const recs: { title: string; detail: string }[] = [];
    const soonEventDay = calendar.cells.find((c) => c.isInMonth && c.demand >= 0.88);
    if (soonEventDay) {
      recs.push({
        title: `Increase price ${Math.round(10 + rnd() * 15)}% due to high demand`,
        detail: `${soonEventDay.d.format("D MMM")}: high demand detected (events / hotel compression).`
      });
    }
    recs.push({
      title: "Lower 8–12% Mon–Wed if there are gaps",
      detail: "Use last‑minute discounts for dates within 7 days."
    });
    recs.push({
      title: "Optimize rules",
      detail: "Reduce minimum nights on gaps and enable weekly discounts for 7+ night stays."
    });
    recs.push({
      title: "Improve listing quality",
      detail: "Refresh hero photos, tighten the title/value prop, and highlight key amenities (parking/self check-in)."
    });
    return recs.slice(0, 5);
  }, [calendar.cells, rnd]);

  const openDayObj = useMemo(() => {
    if (!openDay) return null;
    const d = dayjs(openDay);
    const cell = calendar.cells.find((c) => c.d.isSame(d, "day")) || null;
    if (!cell) return null;
    const x = Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, "0")}:00`);
    const base = cell.price;
    const demand = x.map((_, i) => clamp(cell.demand + 0.10 * Math.sin((i / 12) * Math.PI * 2) + (rnd() - 0.5) * 0.06, 0, 1));
    const adr = x.map((_, i) => clamp(Math.round(base * (0.92 + demand[i] * 0.20)), minPrice, maxPrice));
    const recommended = x.map((_, i) => clamp(Math.round(base * (0.90 + demand[i] * 0.28)), minPrice, maxPrice));
    return { day: d, cell, x, demandPct: demand.map((v) => Math.round(v * 100)), adr, recommended };
  }, [openDay, calendar.cells, rnd, minPrice, maxPrice]);

  const scenarioTable = useMemo(() => {
    const s = [
      { key: "Conservative", mult: 0.94, occ: 1.05 },
      { key: "Balanced", mult: 1.0, occ: 1.0 },
      { key: "Aggressive", mult: 1.08, occ: 0.96 }
    ];
    return s.map((it) => {
      const adr = clamp(Math.round(derived.adrRecommended * it.mult), minPrice, maxPrice);
      const occ = clamp(derived.occRecommended * it.occ, 0.2, 0.95);
      const rev = Math.round(adr * occ * 30);
      return { ...it, adr, occ, rev };
    });
  }, [derived.adrRecommended, derived.occRecommended, minPrice, maxPrice]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Revenue Optimizer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recommend prices, rules, and actions to maximize future revenue.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Chip label={`Strategy: ${strategy}`} />
              <Chip label={`Forecast: next ${horizon} days`} />
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
              No real estate assets found. Revenue Optimizer is enabled only for <strong>property</strong> assets.
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
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
                <InputLabel id="strategy-label">Strategy</InputLabel>
                <Select
                  labelId="strategy-label"
                  label="Strategy"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as any)}
                >
                  <MenuItem value="Conservative">Conservative</MenuItem>
                  <MenuItem value="Balanced">Balanced</MenuItem>
                  <MenuItem value="Aggressive">Aggressive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel id="horizon-label">Days</InputLabel>
                <Select labelId="horizon-label" label="Days" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                  <MenuItem value={30}>30</MenuItem>
                  <MenuItem value={60}>60</MenuItem>
                  <MenuItem value={90}>90</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="month-label">Mes</InputLabel>
                <Select labelId="month-label" label="Mes" value={month} onChange={(e) => setMonth(String(e.target.value))}>
                  {Array.from({ length: 6 }, (_, i) => dayjs().startOf("month").add(i, "month").format("YYYY-MM")).map((m) => (
                    <MenuItem key={m} value={m}>
                      {dayjs(`${m}-01`).format("MMMM YYYY")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Projected current revenue
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {fmtMoney(derived.revenueActual)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Based on base price and estimated occupancy.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Projected optimized revenue
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {fmtMoney(derived.revenueOptimized)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Potential uplift:{" "}
                <strong>
                  {Math.round(((derived.revenueOptimized - derived.revenueActual) / Math.max(1, derived.revenueActual)) * 100)}%
                </strong>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Recommended ADR / occupancy
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {fmtMoney(Math.round(derived.adrRecommended))}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Projected occ: {fmtPct(derived.occRecommended)} • Pacing: {fmtPct(derived.pacing)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography sx={{ fontWeight: 800 }}>Price control</Typography>
              <Typography variant="body2" color="text.secondary">
                Tune bounds and model aggressiveness.
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Min ($)" type="number" value={minPrice} onChange={(e) => setMinPrice(Math.max(0, Number(e.target.value || 0)))} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Base ($)" type="number" value={basePrice} onChange={(e) => setBasePrice(Math.max(0, Number(e.target.value || 0)))} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Max ($)" type="number" value={maxPrice} onChange={(e) => setMaxPrice(Math.max(0, Number(e.target.value || 0)))} />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Aggressiveness
                  </Typography>
                  <Slider value={aggressiveness} onChange={(_, v) => setAggressiveness(Number(v))} valueLabelDisplay="auto" />
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Typography sx={{ fontWeight: 800 }}>Demand curve</Typography>
              <Typography variant="body2" color="text.secondary">
                Hover to explore price → demand sensitivity.
              </Typography>
              <Box sx={{ mt: 2 }}>
                <LineChart
                  height={260}
                  series={[
                    { data: demandCurve.demand.map((v) => Math.round(v * 100)), label: "Demand (%)" },
                    { data: demandCurve.expectedRevenue, label: "Monthly revenue ($)" }
                  ]}
                  xAxis={[{ data: demandCurve.prices, scaleType: "point", label: "Price ($)" }]}
                />
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                <Chip label={`Best price (proxy): ${fmtMoney(demandCurve.bestPrice)}`} />
                <Chip label={`Recommended: ${fmtMoney(demandCurve.recommended)}`} color="success" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography sx={{ fontWeight: 800 }}>Forecast revenue 30/60/90</Typography>
              <Typography variant="body2" color="text.secondary">
                Projection by horizon (proxy).
              </Typography>
              <Box sx={{ mt: 2 }}>
                <BarChart
                  height={260}
                  series={[{ data: forecast.map((f) => f.value), label: "Revenue ($)" }]}
                  xAxis={[{ data: forecast.map((f) => `${f.h}d`), scaleType: "band" }]}
                />
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography sx={{ fontWeight: 800 }}>Scenarios</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {scenarioTable.map((s) => (
                  <Grid key={s.key} item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {s.key}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ADR {fmtMoney(s.adr)} • Occ {fmtPct(s.occ)}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, mt: 1 }}>
                          {fmtMoney(s.rev)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Alert severity={derived.vacancyRisk >= 0.55 ? "warning" : "info"} sx={{ mt: 2 }}>
                Vacancy risk: {fmtPct(derived.vacancyRisk)} • Adjust strategy and rules to mitigate.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography sx={{ fontWeight: 800 }}>Recommended pricing calendar</Typography>
          <Typography variant="body2" color="text.secondary">
            Hover shows demand; click opens Daily Pricing Intelligence.
          </Typography>
          <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <Typography key={d} variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                {d}
              </Typography>
            ))}
            {calendar.cells.map((c, idx) => (
              <Tooltip
                key={`${idx}-${c.d.format("YYYY-MM-DD")}`}
                title={`Demand: ${Math.round(c.demand * 100)}% • Occ: ${Math.round(c.occupancy * 100)}%`}
              >
                <Box
                  onClick={() => c.isInMonth && setOpenDay(c.d.format("YYYY-MM-DD"))}
                  sx={{
                    cursor: c.isInMonth ? "pointer" : "default",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: c.isInMonth ? `hsl(145 45% ${92 - c.demand * 35}%)` : "transparent",
                    p: 1,
                    minHeight: 68,
                    opacity: c.isInMonth ? 1 : 0.35
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {c.d.date()}
                    </Typography>
                    {c.isInMonth && c.demand >= 0.86 ? (
                      <Chip size="small" label="opp" color="success" sx={{ height: 20 }} />
                    ) : null}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {fmtMoney(c.price)}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography sx={{ fontWeight: 800 }}>Recommendations feed</Typography>
                <Typography variant="body2" color="text.secondary">
                  Prioritized actions with explanations.
                </Typography>
              <List dense sx={{ mt: 1 }}>
                {recommendations.map((r, idx) => (
                  <ListItem key={idx}>
                    <ListItemText primary={r.title} secondary={r.detail} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography sx={{ fontWeight: 800 }}>Model explanation</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Combined signals: seasonality, events, pacing, hotel rates (Amadeus), and internal CRM/WhatsApp demand signals.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Optimizable rules: minimum nights, last‑minute discounts, weekly discounts, visible fees, and cancellation policy.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Alert severity="info">These values are UI placeholders until real sources are connected.</Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={Boolean(openDayObj)} onClose={() => setOpenDay(null)} maxWidth="md" fullWidth>
        <DialogTitle>Daily Pricing Intelligence — {openDayObj?.day.format("ddd, D MMM YYYY")}</DialogTitle>
        <DialogContent dividers>
          {openDayObj ? (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Demand
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {Math.round(openDayObj.cell.demand * 100)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Occ proxy: {Math.round(openDayObj.cell.occupancy * 100)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        ADR (baseline)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {fmtMoney(openDayObj.cell.price)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Recommended price for the day
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Action
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {openDayObj.cell.demand >= 0.86
                          ? "Raise price and enforce a 2-night minimum."
                          : "Lower price and enable last‑minute discounts."}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card variant="outlined">
                <CardContent>
                  <Typography sx={{ fontWeight: 800 }}>Intraday view (proxy)</Typography>
                  <Box sx={{ mt: 2 }}>
                    <LineChart
                      height={260}
                      series={[
                        { data: openDayObj.demandPct, label: "Demand (%)" },
                        { data: openDayObj.adr, label: "ADR ($)" },
                        { data: openDayObj.recommended, label: "Recommended ($)" }
                      ]}
                      xAxis={[{ data: openDayObj.x, scaleType: "point" }]}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDay(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
