# Deploying to Railway

A checklist for the first production deploy. Settings rationale: ARCHITECTURE.md §16.

## 1. Before deploying

**MongoDB Atlas**

- **Region: put the Atlas cluster and the Railway service in the same region** (for example both in
  Europe West). Every page makes a few database round trips; across continents each costs about
  0.1–0.3 s, in the same region about 1–2 ms. This matters more than anything else for speed.
- Network Access: allow `0.0.0.0/0` (Railway has no fixed outgoing IP on standard plans). The
  connection string's user should have access to the production database only.

**Cloudflare R2: recitation audio (private bucket, e.g. `tilawah-audio`)**

- API token with Object Read & Write on this bucket.
- CORS policy (browsers upload directly with presigned `PUT`):
  ```json
  [
    {
      "AllowedOrigins": ["https://<your-app>.up.railway.app"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["content-type"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

**Cloudflare R2: speech models (public bucket, e.g. `tilawah-models`)**

1. Create the bucket and enable public access (the `r2.dev` URL, or a custom domain later).
2. CORS policy: `AllowedOrigins` = the app URL, `AllowedMethods` = `GET, HEAD`.
3. Upload from this machine (the token needs write access to this bucket):
   ```sh
   MODELS_BUCKET=tilawah-models pnpm --filter @tilawah/web models:upload
   ```
   About 390 MB (both models, WebGPU and WebAssembly variants); each user downloads one variant
   (67–142 MB) once. Checksums are verified against `MANIFEST.json` before upload.
4. Use the bucket's public URL as `NEXT_PUBLIC_SPEECH_MODEL_BASE_URL`.

**Brevo**

- Senders & IP → verify the address used in `EMAIL_FROM` (unverified senders are rejected).

## 2. Railway service `web`

| Setting           | Value                                        |
| ----------------- | -------------------------------------------- |
| Source            | This repository, root directory `/`          |
| Build command     | `pnpm turbo run build --filter=@tilawah/web` |
| Start command     | `pnpm --filter @tilawah/web start`           |
| Health check path | `/api/v1/health`                             |
| Restart policy    | On failure                                   |

Node 24 and pnpm 12 are picked up from `.nvmrc` and `packageManager`.

**Variables** (all of `.env.example`). Production values that differ from local:

| Variable                                                       | Value                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`                       | `https://<your-app>.up.railway.app`                                                           |
| `API_ALLOWED_ORIGINS`                                          | the same URL                                                                                  |
| `BETTER_AUTH_SECRET`, `UPLOAD_TICKET_SECRET`, `IP_HASH_SECRET` | new values: `openssl rand -base64 32` each (do not reuse local ones)                          |
| `MONGODB_URI`                                                  | production Atlas database                                                                     |
| `R2_*`                                                         | audio bucket and token                                                                        |
| `EMAIL_TRANSPORT`                                              | `brevo`                                                                                       |
| `NEXT_PUBLIC_SPEECH_MODEL_BASE_URL`                            | the models bucket URL (must be set **before** the build: `NEXT_PUBLIC_*` values are built in) |
| `STORAGE_DRIVER`, `LOCAL_STORAGE_DIR`, `AUTH_RATE_LIMIT`       | leave unset                                                                                   |

Check a copy of the production values locally before pasting them into Railway:
`pnpm --filter @tilawah/web env:check` (reads `.env.local`).

## 3. Railway service `maintenance` (cron)

Same repository and build. Start command `pnpm --filter @tilawah/web maintenance`, cron schedule
`0 3 * * *` (daily 03:00 UTC), same variables.

## 4. After the first deploy

1. `GET /api/v1/health` returns `ok`.
2. Sign up → the verification email arrives.
3. Upload a short recitation → it appears in the moderation queue.
4. Make your account admin. There is no sign-up path to staff roles; set it once in Atlas:
   `db.users.updateOne({ email: "<you>" }, { $set: { role: "admin" } })`. Then approve the
   recitation and play it.
5. Memorize → Al-Ikhlas → the model downloads from the models bucket (browser network tab) and
   words appear as you recite.

Do not run the seed in production: it creates demo accounts with a known password.
