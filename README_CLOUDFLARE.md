# Deploy `frontend/admin` to Cloudflare Pages

This is a Vite + React Router SPA. Cloudflare Pages must be configured to serve `index.html` for all routes.

## Cloudflare Pages (Dashboard)

1) Cloudflare Dashboard → **Pages** → **Create a project** → connect your Git repo.
2) Select the `frontend/admin` folder as the project root (or set **Root directory** to `frontend/admin`).
3) Build settings:
   - **Build command**: `npm ci && npm run build`
   - **Build output directory**: `dist`
4) Environment variables (Settings → Environment variables):
   - `VITE_CORE_API_BASE_URL` = `https://<your-core-api-host>`
   - `VITE_PRICING_API_BASE_URL` = `https://<your-core-api-host>` (dev uses core-api mock; set pricing-api only when it exists)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID` (optional)

Notes:
- SPA routing is handled by `public/_redirects`.
- Assets caching + basic security headers are in `public/_headers`.
- If Firebase env vars are missing at build time, the app will show a “Firebase is not configured” error on `/login`.

## Cloudflare Pages (CLI via Wrangler)

Install:
```bash
npm i -g wrangler
```

Build and deploy:
```bash
cd frontend/admin
npm ci
npm run build
wrangler pages deploy dist --project-name str-admin
```

Set env vars:
```bash
wrangler pages secret put VITE_CORE_API_BASE_URL --project-name str-admin
wrangler pages secret put VITE_PRICING_API_BASE_URL --project-name str-admin
wrangler pages secret put VITE_FIREBASE_API_KEY --project-name str-admin
wrangler pages secret put VITE_FIREBASE_AUTH_DOMAIN --project-name str-admin
wrangler pages secret put VITE_FIREBASE_PROJECT_ID --project-name str-admin
wrangler pages secret put VITE_FIREBASE_STORAGE_BUCKET --project-name str-admin
wrangler pages secret put VITE_FIREBASE_MESSAGING_SENDER_ID --project-name str-admin
wrangler pages secret put VITE_FIREBASE_APP_ID --project-name str-admin
```

If you also want preview environments, add `--branch <name>` in `wrangler pages deploy`.
