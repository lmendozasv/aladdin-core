import { Alert, Box, Card, CardContent, Divider, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { dashboardRevenue, dashboardSummary } from "../../api/core";
import { getAccessToken } from "../../state/session";
import { LineChart } from "@mui/x-charts/LineChart";

export default function Dashboard() {
  const [msg, setMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [revenue, setRevenue] = useState<any[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setMsg("Missing session token. Go to Login.");
      return;
    }
    Promise.all([dashboardSummary(token), dashboardRevenue(token)])
      .then(([s, r]) => {
        setSummary(s);
        setRevenue(r.items || []);
      })
      .catch((e) => setMsg(e?.message || String(e)));
  }, []);

  return (
    <>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h4">Financial Operator Control Center</Typography>
        <Typography color="text.secondary">
          Real-time KPIs, occupancy insights, and revenue performance for multi-vertical STR operations.
        </Typography>
      </Stack>
      {msg ? <Alert severity="error" sx={{ mb: 2 }}>{msg}</Alert> : null}

      <Grid container spacing={2}>
        {[
          { label: "Active Listings", value: summary?.active_listings ?? "—" },
          { label: "Revenue", value: summary ? `$${((summary.revenue_cents || 0) / 100).toFixed(2)}` : "—" },
          { label: "Reservations", value: summary?.reservations ?? "—" },
          { label: "AI Forecasts", value: "Pending" }
        ].map((m) => (
          <Grid item xs={12} sm={6} md={3} key={m.label}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                borderRadius: 4,
                bgcolor: "background.paper"
              }}
            >
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {m.label}
                </Typography>
                <Typography variant="h5">{m.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">Revenue trend</Typography>
              <Typography variant="body2" color="text.secondary">
                Daily revenue derived from confirmed/completed reservations (v1).
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ my: 2 }} />
          {revenue.length ? (
            <LineChart
              height={280}
              series={[
                {
                  data: revenue.map((p) => (p.revenue_cents || 0) / 100),
                  label: "Revenue ($)",
                  showMark: false
                }
              ]}
              xAxis={[{ scaleType: "point", data: revenue.map((p) => p.day) }]}
              margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
            />
          ) : (
            <Typography color="text.secondary">No data yet.</Typography>
          )}
        </CardContent>
      </Card>
    </>
  );
}
