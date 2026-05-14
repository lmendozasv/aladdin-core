export type Tokens = { access_token: string; refresh_token: string };

export function coreBaseUrl(): string {
  // Prefer same-origin in dev (Vite proxy). In prod, set VITE_CORE_API_BASE_URL.
  return (import.meta.env.VITE_CORE_API_BASE_URL || "").trim();
}

export function tenantDomain(): string {
  return import.meta.env.VITE_TENANT_DOMAIN || "";
}

export function pricingBaseUrl(): string {
  // Default to core-api while pricing-api is not deployed.
  const v = (import.meta.env.VITE_PRICING_API_BASE_URL || "").trim();
  if (v) return v;
  return coreBaseUrl();
}

export async function authExchange(firebaseIdToken: string): Promise<Tokens> {
  const res = await fetch(`${coreBaseUrl()}/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firebaseIdToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    },
    body: JSON.stringify({ provider: "firebase" })
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Tokens;
}

export async function listAssets(accessToken: string) {
  const res = await fetch(`${coreBaseUrl()}/api/v1/assets`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createAsset(accessToken: string, asset_type: string, name: string) {
  const res = await fetch(`${coreBaseUrl()}/api/v1/assets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    },
    body: JSON.stringify({ asset_type, name })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listReservations(accessToken: string, from?: string, to?: string, asset_id?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (asset_id) qs.set("asset_id", asset_id);
  const res = await fetch(`${coreBaseUrl()}/api/v1/reservations?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createReservation(
  accessToken: string,
  body: {
    asset_id: string;
    check_in: string;
    check_out: string;
    currency?: string;
    total_amount_cents?: number;
    guest?: { email?: string; full_name?: string; phone?: string };
  }
) {
  const res = await fetch(`${coreBaseUrl()}/api/v1/reservations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function calendar(accessToken: string, from?: string, to?: string, asset_id?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (asset_id) qs.set("asset_id", asset_id);
  const res = await fetch(`${coreBaseUrl()}/api/v1/calendar?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dashboardSummary(accessToken: string, from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await fetch(`${coreBaseUrl()}/api/v1/dashboard/summary?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dashboardRevenue(accessToken: string, from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await fetch(`${coreBaseUrl()}/api/v1/dashboard/revenue?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dashboardOccupancy(accessToken: string, from?: string, to?: string, asset_id?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (asset_id) qs.set("asset_id", asset_id);
  const res = await fetch(`${coreBaseUrl()}/api/v1/dashboard/occupancy?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pricingRecommendations(accessToken: string, asset_id: string, from: string, to: string) {
  const qs = new URLSearchParams({ asset_id, from, to });
  const base = pricingBaseUrl();
  const res = await fetch(`${base}/pricing/v1/recommendations?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pricingOverrideUpsert(
  accessToken: string,
  body: { asset_id: string; day: string; override_price_cents: number; currency?: string; reason?: string }
) {
  const base = pricingBaseUrl();
  const res = await fetch(`${base}/pricing/v1/overrides`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pricingRulesList(accessToken: string, asset_id?: string) {
  const qs = new URLSearchParams();
  if (asset_id) qs.set("asset_id", asset_id);
  const base = pricingBaseUrl();
  const res = await fetch(`${base}/pricing/v1/pricing-rules?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pricingRulesCreate(
  accessToken: string,
  body: { name: string; asset_id?: string; enabled?: boolean; rule?: any }
) {
  const base = pricingBaseUrl();
  const res = await fetch(`${base}/pricing/v1/pricing-rules`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pricingGenerateRecommendations(
  accessToken: string,
  body: { asset_id: string; from: string; to: string; rule_id?: string }
) {
  const base = pricingBaseUrl();
  const res = await fetch(`${base}/pricing/v1/recommendations/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(tenantDomain() ? { "X-Tenant-Domain": tenantDomain() } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
