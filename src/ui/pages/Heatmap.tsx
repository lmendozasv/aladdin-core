import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import {
  dashboardOccupancy,
  listAssets,
  pricingGenerateRecommendations,
  pricingOverrideUpsert,
  pricingRecommendations,
  pricingRulesCreate,
  pricingRulesList
} from "../../api/core";
import { getAccessToken } from "../../state/session";
import dayjs from "dayjs";
import { LineChart } from "@mui/x-charts/LineChart";

type Asset = { id: string; name: string; asset_type: string };
type OccPoint = { day: string; reserved_nights: number };
type PricePoint = { day: string; price_cents: number; source?: string };

function monthStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function monthEnd(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}
function isoDate(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildMonthGrid(start: Date) {
  // Sunday-start grid, 6 weeks.
  const first = new Date(start);
  const dayOfWeek = first.getUTCDay();
  first.setUTCDate(first.getUTCDate() - dayOfWeek);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setUTCDate(first.getUTCDate() + i);
    cells.push(d);
  }
  return cells;
}

function moneyToCents(s: string): number {
  const n = Number(String(s).trim());
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
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

export default function Heatmap() {
  const token = useMemo(() => getAccessToken(), []);

  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState<string>("");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState<"" | "property" | "car" | "yacht">("");

  const now = new Date();
  const [month, setMonth] = useState<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const monthDate = useMemo(
    () => new Date(Date.UTC(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1, 1)),
    [month]
  );
  const from = useMemo(() => isoDate(monthStart(monthDate)), [monthDate]);
  const to = useMemo(() => isoDate(monthEnd(monthDate)), [monthDate]);
  const cells = useMemo(() => buildMonthGrid(monthStart(monthDate)), [monthDate]);
  const activeMonth = monthDate.getUTCMonth();

  const [occ, setOcc] = useState<Record<string, OccPoint>>({});
  const [price, setPrice] = useState<Record<string, PricePoint>>({});

  const [mode, setMode] = useState<"sync" | "manual">("sync");
  const [analysisGranularity, setAnalysisGranularity] = useState<"day" | "week" | "hour" | "month">("day");
  const [thresholds, setThresholds] = useState<{ min: string; base: string; max: string; weekendMult: string }>({
    min: "100",
    base: "150",
    max: "400",
    weekendMult: "1.15"
  });

  const [editDay, setEditDay] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");

  const filteredAssets = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    return assets.filter((a) => {
      if (assetTypeFilter && a.asset_type !== assetTypeFilter) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
    });
  }, [assets, assetQuery, assetTypeFilter]);

  async function refreshGrid() {
    if (!token) throw new Error("Missing session token. Go to Login.");
    if (!assetId) return;
    const [o, p] = await Promise.all([
      dashboardOccupancy(token, from, to, assetId),
      pricingRecommendations(token, assetId, from, to)
    ]);
    const om: Record<string, OccPoint> = {};
    for (const it of o.items || []) om[it.day] = it;
    setOcc(om);
    const pm: Record<string, PricePoint> = {};
    for (const it of p.items || []) pm[it.day] = it;
    setPrice(pm);
  }

  useEffect(() => {
    if (!token) {
      setError("Missing session token. Go to Login.");
      return;
    }
    listAssets(token)
      .then((d) => setAssets(d.items || []))
      .catch((e) => setError(e.message || String(e)));
  }, []);

  useEffect(() => {
    if (!token || !assetId) return;
    setError(null);
    Promise.all([refreshGrid(), pricingRulesList(token, assetId)])
      .then(([, r]) => {
        const items = r.items || [];
        if (!items.length) return;
        const latest = items[0];
        let ruleObj: any = latest.rule;
        if (typeof ruleObj === "string") {
          try {
            ruleObj = JSON.parse(ruleObj);
          } catch {
            ruleObj = {};
          }
        }
        setThresholds({
          min: ruleObj?.min_price_cents != null ? String(Math.round(ruleObj.min_price_cents / 100)) : "100",
          base: ruleObj?.base_price_cents != null ? String(Math.round(ruleObj.base_price_cents / 100)) : "150",
          max: ruleObj?.max_price_cents != null ? String(Math.round(ruleObj.max_price_cents / 100)) : "400",
          weekendMult: ruleObj?.weekend_multiplier != null ? String(ruleObj.weekend_multiplier) : "1.15"
        });
      })
      .catch((e) => setError(e.message || String(e)));
  }, [assetId, from, to]);

  const analysisSeries = useMemo(() => {
    // JSON-fixed but dynamic: deterministic synthetic market data per asset + time range.
    if (!assetId) return null;
    const seed = hashSeed(`${assetId}|${from}|${to}|${analysisGranularity}`);
    const rnd = mulberry32(seed);

    const minC = moneyToCents(thresholds.min);
    const baseC = moneyToCents(thresholds.base);
    const maxC = moneyToCents(thresholds.max);
    const safeBase = Number.isFinite(baseC) && baseC > 0 ? baseC : 15000;
    const safeMin = Number.isFinite(minC) && minC > 0 ? minC : 10000;
    const safeMax = Number.isFinite(maxC) && maxC > 0 ? maxC : 40000;

    function clamp(v: number) {
      return Math.max(safeMin, Math.min(safeMax, v));
    }

    function askForDay(d: string): number {
      const cents = price[d]?.price_cents;
      if (typeof cents === "number" && cents > 0) return clamp(cents);
      // fallback: simple weekday/weekend curve around base
      const dt = dayjs(d);
      const isWeekend = dt.day() === 5 || dt.day() === 6;
      const w = Number(thresholds.weekendMult) || 1.15;
      return clamp(Math.round(safeBase * (isWeekend ? w : 1)));
    }

    if (analysisGranularity === "hour") {
      const day = from;
      const x = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
      const ask0 = askForDay(day);
      const ask = x.map((_, i) => clamp(Math.round(ask0 * (0.92 + 0.16 * Math.sin((i / 24) * Math.PI * 2)))));
      const demand = ask.map((v, i) => clamp(Math.round(v * (1.03 + 0.08 * rnd()) + (i % 6 === 0 ? 500 : 0))));
      const competitor = ask.map((v) => clamp(Math.round(v * (0.80 + 0.10 * rnd()))));
      const recommended = ask.map((v, i) => Math.round(Math.min(demand[i], Math.max(competitor[i], (v + demand[i]) / 2))));
      return { x, ask, demand, competitor, recommended, label: `Hourly view (${day})` };
    }

    if (analysisGranularity === "month") {
      const end = dayjs(from).add(5, "month");
      const start = dayjs(from);
      const months: string[] = [];
      for (let d = start; d.isBefore(end) || d.isSame(end, "month"); d = d.add(1, "month")) {
        months.push(d.format("YYYY-MM"));
      }
      const ask = months.map((m) => {
        const d0 = `${m}-15`;
        return clamp(Math.round(askForDay(d0) * (0.95 + 0.1 * rnd())));
      });
      const demand = ask.map((v) => clamp(Math.round(v * (1.05 + 0.12 * rnd()))));
      const competitor = ask.map((v) => clamp(Math.round(v * (0.78 + 0.12 * rnd()))));
      const recommended = ask.map((v, i) => Math.round(Math.min(demand[i], Math.max(competitor[i], (v + demand[i]) / 2))));
      return { x: months, ask, demand, competitor, recommended, label: "Monthly view" };
    }

    if (analysisGranularity === "week") {
      const start = dayjs(from).startOf("day");
      const end = dayjs(to).startOf("day");
      const x: string[] = [];
      const ask: number[] = [];
      const demand: number[] = [];
      const competitor: number[] = [];
      const recommended: number[] = [];

      let idx = 1;
      for (let d = start; d.isBefore(end) || d.isSame(end, "day"); d = d.add(7, "day")) {
        const weekStart = d;
        const rawEnd = d.add(6, "day");
        const weekEnd = rawEnd.isAfter(end) ? end : rawEnd;
        const label = `W${idx} (${weekStart.format("MM/DD")})`;
        idx += 1;

        const daysInWeek: string[] = [];
        for (let dd = weekStart; dd.isBefore(weekEnd) || dd.isSame(weekEnd, "day"); dd = dd.add(1, "day")) {
          daysInWeek.push(dd.format("YYYY-MM-DD"));
        }

        const avgAsk = clamp(Math.round(daysInWeek.reduce((sum, day) => sum + askForDay(day), 0) / Math.max(1, daysInWeek.length)));
        const wkAsk = clamp(Math.round(avgAsk * (0.97 + 0.08 * rnd())));
        const wkDemand = clamp(Math.round(wkAsk * (1.04 + 0.10 * rnd())));
        const wkCompetitor = clamp(Math.round(wkAsk * (0.78 + 0.12 * rnd())));
        const wkRecommended = Math.round(Math.min(wkDemand, Math.max(wkCompetitor, (wkAsk + wkDemand) / 2)));

        x.push(label);
        ask.push(wkAsk);
        demand.push(wkDemand);
        competitor.push(wkCompetitor);
        recommended.push(wkRecommended);
      }

      return { x, ask, demand, competitor, recommended, label: "Weekly view" };
    }

    // day granularity
    const start = dayjs(from);
    const end = dayjs(to);
    const days: string[] = [];
    for (let d = start; d.isBefore(end) || d.isSame(end, "day"); d = d.add(1, "day")) {
      days.push(d.format("YYYY-MM-DD"));
    }
    const ask = days.map((d) => askForDay(d));
    const demand = ask.map((v) => clamp(Math.round(v * (1.04 + 0.10 * rnd()))));
    const competitor = ask.map((v) => clamp(Math.round(v * (0.78 + 0.12 * rnd()))));
    const recommended = ask.map((v, i) => Math.round(Math.min(demand[i], Math.max(competitor[i], (v + demand[i]) / 2))));
    return { x: days, ask, demand, competitor, recommended, label: "Daily view" };
  }, [assetId, from, to, analysisGranularity, thresholds, price]);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "440px 1fr" }, gap: 2, alignItems: "start" }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Aladdin Pricing Engine</Typography>
          <Typography color="text.secondary">
            Min / Base / Max thresholds, sync controls, occupancy + daily pricing.
          </Typography>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  label="Search listings"
                  value={assetQuery}
                  onChange={(e) => setAssetQuery(e.target.value)}
                  placeholder="apartment / villa / car..."
                />
                <TextField
                  select
                  size="small"
                  label="Type"
                  value={assetTypeFilter}
                  onChange={(e) => setAssetTypeFilter(e.target.value as any)}
                  sx={{ width: 140 }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="property">Property</MenuItem>
                  <MenuItem value="car">Car</MenuItem>
                  <MenuItem value="yacht">Yacht</MenuItem>
                </TextField>
              </Stack>

              <TextField select size="small" label="Listing" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <MenuItem value="">Select asset</MenuItem>
                {filteredAssets.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({a.asset_type})
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip size="small" label={`Range ${from} → ${to}`} />
                <TextField
                  size="small"
                  label="Month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="YYYY-MM"
                  sx={{ width: 140 }}
                />
                <Button variant="outlined" disabled={!assetId} onClick={() => refreshGrid().catch((e) => setError(e.message || String(e)))}>
                  Refresh
                </Button>
              </Stack>

              <ToggleButtonGroup
                size="small"
                value={mode}
                exclusive
                onChange={(_, v) => {
                  if (v === "sync" || v === "manual") setMode(v);
                }}
              >
                <ToggleButton value="sync">Sync price</ToggleButton>
                <ToggleButton value="manual">Manual</ToggleButton>
              </ToggleButtonGroup>

              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Min ($)" value={thresholds.min} onChange={(e) => setThresholds((s) => ({ ...s, min: e.target.value }))} />
                <TextField size="small" label="Base ($)" value={thresholds.base} onChange={(e) => setThresholds((s) => ({ ...s, base: e.target.value }))} />
                <TextField size="small" label="Max ($)" value={thresholds.max} onChange={(e) => setThresholds((s) => ({ ...s, max: e.target.value }))} />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  label="Weekend x"
                  value={thresholds.weekendMult}
                  onChange={(e) => setThresholds((s) => ({ ...s, weekendMult: e.target.value }))}
                  sx={{ width: 160 }}
                />
                <Button
                  variant="contained"
                  disabled={!assetId}
                  onClick={async () => {
                    try {
                      setError(null);
                      if (!token) throw new Error("Missing session token.");
                      if (!assetId) throw new Error("Select a listing.");
                      const min = moneyToCents(thresholds.min);
                      const base = moneyToCents(thresholds.base);
                      const max = moneyToCents(thresholds.max);
                      const wm = Number(thresholds.weekendMult);
                      if (![min, base, max].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Invalid thresholds.");
                      if (!Number.isFinite(wm) || wm <= 0) throw new Error("Invalid weekend multiplier.");

                      await pricingRulesCreate(token, {
                        name: `Heatmap thresholds (${assetId.slice(0, 8)})`,
                        asset_id: assetId,
                        enabled: true,
                        rule: { base_price_cents: base, weekend_multiplier: wm, min_price_cents: min, max_price_cents: max }
                      });

                      if (mode === "sync") {
                        await pricingGenerateRecommendations(token, { asset_id: assetId, from, to });
                        await refreshGrid();
                      }
                    } catch (e: any) {
                      setError(e?.message || String(e));
                    }
                  }}
                >
                  Save {mode === "sync" ? "& Sync" : ""}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">Market Price Analysis</Typography>
                <Typography variant="body2" color="text.secondary">
                  Ask (your price), Demand (searching users), Competitor (lowest nearby) + Recommended (between ask & bid).
                </Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Granularity</InputLabel>
                <Select
                  label="Granularity"
                  value={analysisGranularity}
                  onChange={(e) => setAnalysisGranularity(e.target.value as any)}
                >
                  <MenuItem value="day">Day</MenuItem>
                  <MenuItem value="week">Week</MenuItem>
                  <MenuItem value="hour">Hour</MenuItem>
                  <MenuItem value="month">Month</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Divider sx={{ my: 2 }} />

            {analysisSeries ? (
              <LineChart
                height={280}
                series={[
                  { data: analysisSeries.ask.map((v) => v / 100), label: "Ask (yours)", showMark: false },
                  { data: analysisSeries.demand.map((v) => v / 100), label: "Demand (search)", showMark: false },
                  { data: analysisSeries.competitor.map((v) => v / 100), label: "Competitor low", showMark: false },
                  {
                    data: analysisSeries.recommended.map((v) => v / 100),
                    label: "Recommended",
                    showMark: false
                  }
                ]}
                xAxis={[{ scaleType: "point", data: analysisSeries.x }]}
                margin={{ left: 70, right: 20, top: 20, bottom: 40 }}
              />
            ) : (
              <Typography color="text.secondary">Select an asset to see analysis.</Typography>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }} alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#fafafa", border: "1px solid", borderColor: "divider" }} />
                <Typography variant="caption">Available</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#c8e6c9", border: "1px solid", borderColor: "divider" }} />
                <Typography variant="caption">Occupied</Typography>
              </Stack>
              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Click a day to override price.
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <Typography key={d} variant="overline" color="text.secondary">
                  {d}
                </Typography>
              ))}
              {cells.map((d) => {
                const key = isoDate(d);
                const inMonth = d.getUTCMonth() === activeMonth;
                const reserved = (occ[key]?.reserved_nights || 0) > 0;
                const cents = price[key]?.price_cents;
                const priceText = cents != null ? `$${(cents / 100).toFixed(0)}` : "—";
                const isOverride = price[key]?.source === "override";

                const priceBucket = cents == null ? 0 : cents < 10000 ? 1 : cents < 20000 ? 2 : cents < 30000 ? 3 : 4;
                const bg = reserved
                  ? ["#e8f5e9", "#c8e6c9", "#a5d6a7", "#81c784", "#66bb6a"][priceBucket]
                  : ["#fafafa", "#f3f6ff", "#e8efff", "#dce8ff", "#d0e1ff"][priceBucket];

                return (
                  <Box
                    key={key}
                    onClick={() => {
                      if (!assetId || !inMonth) return;
                      setEditDay(key);
                      setEditPrice(cents != null ? String(Math.round(cents / 100)) : "");
                      setEditReason("");
                    }}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 1,
                      bgcolor: inMonth ? bg : "action.disabledBackground",
                      minHeight: 86,
                      cursor: inMonth && assetId ? "pointer" : "default",
                      outline: isOverride ? "2px solid rgba(156,39,176,0.35)" : "none"
                    }}
                  >
                    <Stack spacing={0.25}>
                      <Typography variant="caption" color={inMonth ? "text.secondary" : "text.disabled"}>
                        {d.getUTCDate()}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {priceText}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {reserved ? "Occupied" : "Available"}
                        {occ[key]?.reserved_nights ? ` • ${occ[key].reserved_nights}u` : ""}
                      </Typography>
                      {isOverride ? (
                        <Typography variant="caption" sx={{ color: "secondary.main", fontWeight: 800 }}>
                          Override
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        <Dialog open={!!editDay} onClose={() => setEditDay("")} fullWidth maxWidth="sm">
          <DialogTitle>Override price</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography color="text.secondary">{assetId ? `Day: ${editDay}` : ""}</Typography>
              <TextField label="Override price (USD)" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="150" />
              <TextField
                label="Reason (optional)"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Local event / last-minute promotion"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Typography sx={{ flex: 1 }} />
            <Button onClick={() => setEditDay("")}>Cancel</Button>
            <Button
              variant="contained"
              onClick={async () => {
                try {
                  setError(null);
                  if (!token) throw new Error("Missing session token.");
                  const usd = Number(editPrice);
                  if (!assetId) throw new Error("Missing asset.");
                  if (!editDay) throw new Error("Missing day.");
                  if (!Number.isFinite(usd) || usd <= 0) throw new Error("Invalid price.");
                  await pricingOverrideUpsert(token, {
                    asset_id: assetId,
                    day: editDay,
                    override_price_cents: Math.round(usd * 100),
                    currency: "USD",
                    reason: editReason || undefined
                  });
                  setEditDay("");
                  await refreshGrid();
                } catch (e: any) {
                  setError(e?.message || String(e));
                }
              }}
            >
              Save override
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
}
