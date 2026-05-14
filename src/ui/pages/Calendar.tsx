import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { calendar, createReservation, listAssets } from "../../api/core";
import { getAccessToken } from "../../state/session";

type Asset = { id: string; name: string; asset_type: string };
type Reservation = {
  id: string;
  asset_id: string;
  status: string;
  check_in: string;
  check_out: string;
  total_amount_cents: number;
  currency: string;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CalendarPage() {
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState<string>("");
  const [from, setFrom] = useState<string>(todayISO());
  const [to, setTo] = useState<string>("");
  const [items, setItems] = useState<Reservation[]>([]);

  const [newCheckIn, setNewCheckIn] = useState(todayISO());
  const [newCheckOut, setNewCheckOut] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const token = useMemo(() => getAccessToken(), []);

  async function loadAssets() {
    if (!token) throw new Error("Missing session token. Go to Dashboard and sign in.");
    const data = await listAssets(token);
    setAssets(data.items || []);
  }

  async function refresh() {
    setError(null);
    if (!token) throw new Error("Missing session token. Go to Dashboard and sign in.");
    const data = await calendar(token, from || undefined, to || undefined, assetId || undefined);
    setItems(data.reservations || []);
  }

  useEffect(() => {
    loadAssets()
      .then(() => refresh())
      .catch((e) => setError(e.message || String(e)));
  }, []);

  async function onCreateReservation() {
    setError(null);
    if (!token) {
      setError("Missing session token.");
      return;
    }
    if (!assetId) {
      setError("Select an asset first.");
      return;
    }
    await createReservation(token, {
      asset_id: assetId,
      check_in: newCheckIn,
      check_out: newCheckOut,
      guest: { full_name: newName || undefined, email: newEmail || undefined },
      currency: "USD",
      total_amount_cents: 0
    });
    setNewName("");
    setNewEmail("");
    setNewCheckOut("");
    await refresh();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Calendar</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField
              select
              label="Asset"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">All assets</MenuItem>
              {assets.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name} ({a.asset_type})
                </MenuItem>
              ))}
            </TextField>
            <TextField label="From" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="YYYY-MM-DD" />
            <TextField label="To" value={to} onChange={(e) => setTo(e.target.value)} placeholder="YYYY-MM-DD" />
            <Button variant="contained" onClick={() => refresh().catch((e) => setError(e.message || String(e)))}>
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Create reservation
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField label="Guest name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <TextField label="Guest email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <TextField label="Check-in" value={newCheckIn} onChange={(e) => setNewCheckIn(e.target.value)} />
            <TextField label="Check-out" value={newCheckOut} onChange={(e) => setNewCheckOut(e.target.value)} />
            <Button variant="outlined" onClick={() => onCreateReservation().catch((e) => setError(e.message || String(e)))}>
              Create
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Reservations
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {items.map((r) => (
              <Box key={r.id} sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Typography sx={{ width: 110 }} color="text.secondary">
                  {r.status}
                </Typography>
                <Typography sx={{ flex: 1 }}>
                  {r.check_in} → {r.check_out}
                </Typography>
                <Typography color="text.secondary">{r.asset_id.slice(0, 8)}…</Typography>
              </Box>
            ))}
            {items.length === 0 ? <Typography color="text.secondary">No reservations found.</Typography> : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

