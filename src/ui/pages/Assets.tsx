import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { createAsset, listAssets } from "../../api/core";
import { getAccessToken } from "../../state/session";

type Asset = {
  id: string;
  asset_type: string;
  name: string;
  status: string;
  created_at: string;
};

export default function Assets() {
  const [items, setItems] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assetType, setAssetType] = useState("property");
  const [name, setName] = useState("");

  async function refresh() {
    setError(null);
    const token = getAccessToken();
    if (!token) {
      setError("Missing session token. Go to Dashboard and click “Connect / Login”.");
      return;
    }
    const data = await listAssets(token);
    setItems(data.items || []);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message || String(e)));
  }, []);

  async function onCreate() {
    setError(null);
    const token = getAccessToken();
    if (!token) {
      setError("Missing session token.");
      return;
    }
    await createAsset(token, assetType, name);
    setName("");
    await refresh();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Assets</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField
              select
              label="Type"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="property">Property</MenuItem>
              <MenuItem value="car">Car</MenuItem>
              <MenuItem value="yacht">Yacht</MenuItem>
            </TextField>
            <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button variant="contained" onClick={onCreate} disabled={!name.trim()}>
              Create
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => refresh()}>
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Items
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {items.map((a) => (
              <Box key={a.id} sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Typography sx={{ width: 90 }} color="text.secondary">
                  {a.asset_type}
                </Typography>
                <Typography sx={{ flex: 1 }}>{a.name}</Typography>
                <Typography color="text.secondary">{a.status}</Typography>
              </Box>
            ))}
            {items.length === 0 ? <Typography color="text.secondary">No assets yet.</Typography> : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

