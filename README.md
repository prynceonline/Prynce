# ACTIVE — PRYNCE App Discovery & Distribution

ACTIVE is a public app catalogue for discovering Prynce applications and other approved free digital releases.

## Current status

- Public catalogue UI: deployed through GitHub Pages.
- Search, categories, device filters and saved-app preferences: implemented in the current frontend.
- PWA shell and service worker: implemented; service worker is scoped to `/Prynce/`.
- Real Android APK releases: not yet published.
- Developer submissions and review portal: not yet connected to a live backend.
- Supabase schema foundation: available in `supabase/migrations/`.

The catalogue must distinguish website links, projects in development, and verified downloadable releases. Do not show a download action until a real release asset has been reviewed and published.

## Free/open-source architecture

- **Frontend:** React + Vite.
- **Source control and release assets:** GitHub.
- **Build and deployment automation:** GitHub Actions.
- **Backend:** Supabase (PostgreSQL, Auth and Row Level Security); use the free tier subject to its current limits.
- **Android packaging:** Capacitor for compatible web apps, with Android Studio / Gradle build tooling.
- **Security:** checksum verification, least-privilege access, reviewed release metadata and OWASP guidance.

No paid marketplace builder is required. Hosting, bandwidth, storage and service free-tier limits still apply.

## Database foundation

Apply the SQL migration using the Supabase CLI after selecting the intended Supabase project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --remote --yes
```

The migration creates developer profiles, app records, release metadata and submission records. Row Level Security limits public reads to approved catalogue entries and published releases. Client users cannot publish apps or releases; a trusted review workflow must do that.

APK binaries should be attached to versioned GitHub Releases. Store only their HTTPS asset URL, SHA-256 checksum, file size and release metadata in Supabase. Do not store service-role keys in frontend code.

## Local development

```bash
npm install
npm run dev
npm run build
```

## Release checklist

1. Confirm ownership and permission to distribute each app.
2. Build the Android package from source using a reproducible process.
3. Scan and test the package; record package ID, version, minimum Android version and SHA-256.
4. Publish the binary as a GitHub Release asset.
5. Submit release metadata for review.
6. Publish only after manual approval and installation testing on supported devices.
