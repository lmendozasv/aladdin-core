import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { getAccessToken } from "../../state/session";
import { listAssets, pricingGenerateRecommendations, pricingRulesCreate, pricingRulesList } from "../../api/core";

type Asset = { id: string; name: string; asset_type: string };
type Rule = { id: string; name: string; asset_id?: string; enabled: boolean; rule: any; updated_at: string };

function isoToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PricingRules() {
  const token = useMemo(() => getAccessToken(), []);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [rules, setRules] = useState<Rule[]>([]);

  const [newName, setNewName] = useState("Default rule");
  const [newEnabled, setNewEnabled] = useState(true);
  const [newRuleJson, setNewRuleJson] = useState(
    JSON.stringify(
      { base_price_cents: 15000, weekend_multiplier: 1.15, min_price_cents: 10000, max_price_cents: 40000 },
      null,
      2
    )
  );

  const [genFrom, setGenFrom] = useState(isoToday());
  const [genTo, setGenTo] = useState(isoToday());
  const [genRuleId, setGenRuleId] = useState("");

  async function refresh() {
    setError(null);
    if (!token) throw new Error("Missing session token. Go to Login.");
    const a = await listAssets(token);
    setAssets(a.items || []);
    const r = await pricingRulesList(token, assetId || undefined);
    setRules((r.items || []).map((it: any) => ({ ...it, rule: safeParse(it.rule) })));
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message || String(e)));
  }, [assetId]);

  function safeParse(v: any) {
    if (v == null) return {};
    if (typeof v === "object") return v;
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return { raw: v };
      }
    }
    return { raw: String(v) };
  }

  async function onCreateRule() {
    setError(null);
    if (!token) throw new Error("Missing session token.");
    let ruleObj: any = {};
    try {
      ruleObj = JSON.parse(newRuleJson);
    } catch (e: any) {
      throw new Error("Invalid JSON in rule body.");
    }
    await pricingRulesCreate(token, {
      name: newName,
      asset_id: assetId || undefined,
      enabled: newEnabled,
      rule: ruleObj
    });
    await refresh();
  }

  async function onGenerate() {
    setError(null);
    if (!token) throw new Error("Missing session token.");
    if (!assetId) throw new Error("Select an asset first.");
    await pricingGenerateRecommendations(token, {
      asset_id: assetId,
      from: genFrom,
      to: genTo,
      rule_id: genRuleId || undefined
    });
  }

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Rules Engine</Typography>
        <Typography color="text.secondary">
          Configure pricing rules and generate daily recommendations for the Heatmap.
        </Typography>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField
              select
              label="Asset scope"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              sx={{ minWidth: 280 }}
            >
              <MenuItem value="">Global (all assets)</MenuItem>
              {assets.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name} ({a.asset_type})
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => refresh().catch((e) => setError(e.message || String(e)))}>
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Create rule</Typography>
          <Typography variant="body2" color="text.secondary">
            v1 JSON schema: base_price_cents, weekend_multiplier, min_price_cents, max_price_cents.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField fullWidth label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <TextField
                select
                label="Enabled"
                value={newEnabled ? "true" : "false"}
                onChange={(e) => setNewEnabled(e.target.value === "true")}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="true">true</MenuItem>
                <MenuItem value="false">false</MenuItem>
              </TextField>
              <Button variant="contained" onClick={() => onCreateRule().catch((e) => setError(e.message || String(e)))}>
                Save
              </Button>
            </Stack>
            <TextField
              label="Rule JSON"
              value={newRuleJson}
              onChange={(e) => setNewRuleJson(e.target.value)}
              minRows={10}
              multiline
              inputProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" } }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Generate recommendations</Typography>
          <Typography variant="body2" color="text.secondary">
            Generates (or overwrites) daily recommendations in the DB for the selected asset and date range.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField label="From" value={genFrom} onChange={(e) => setGenFrom(e.target.value)} />
            <TextField label="To" value={genTo} onChange={(e) => setGenTo(e.target.value)} />
            <TextField
              select
              label="Rule"
              value={genRuleId}
              onChange={(e) => setGenRuleId(e.target.value)}
              sx={{ minWidth: 320 }}
              disabled={!rules.length}
            >
              <MenuItem value="">Auto (latest enabled)</MenuItem>
              {rules.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} {r.enabled ? "" : "(disabled)"}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={() => onGenerate().catch((e) => setError(e.message || String(e)))}>
              Generate
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Existing rules</Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1}>
            {rules.map((r) => (
              <Box
                key={r.id}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3
                }}
              >
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.id}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color={r.enabled ? "success.main" : "text.secondary"}>
                    {r.enabled ? "Enabled" : "Disabled"}
                  </Typography>
                </Stack>
                <TextField
                  value={JSON.stringify(r.rule || {}, null, 2)}
                  minRows={6}
                  multiline
                  fullWidth
                  sx={{ mt: 1 }}
                  inputProps={{ readOnly: true, style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" } }}
                />
              </Box>
            ))}
            {rules.length === 0 ? <Typography color="text.secondary">No rules found.</Typography> : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

