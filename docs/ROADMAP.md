# ACTIVE release roadmap

## Stage 1 — Storefront foundation
- [x] Responsive public storefront prototype
- [x] Search and category filters
- [x] App details and project cards
- [x] Existing website destinations where verified
- [ ] Browser build and accessibility test
- [ ] Deploy public preview

## Stage 2 — Real app catalogue
- [ ] Dedicated ACTIVE catalogue schema (do not reuse PRYNCE TV media tables)
- [ ] Public read-only app listings
- [ ] Authenticated developer submissions
- [ ] Admin review and publication states
- [ ] App version and release metadata
- [ ] Screenshots, icons and descriptions

## Stage 3 — Android distribution
- [ ] F-Droid-compatible repository metadata
- [ ] Secure APK upload and quarantine
- [ ] Malware and static analysis pipeline
- [ ] Package ID and signing-certificate continuity checks
- [ ] SHA-256 checksums and signed repository index
- [ ] Update and rollback process
- [ ] Clear Android installation guidance

## Stage 4 — Public launch
- [ ] Production hosting and domain
- [ ] Privacy policy, terms and takedown process
- [ ] Accessibility, performance and security testing
- [ ] Backup and recovery drills
- [ ] Public launch only after real release artifacts pass checks

## Guardrails
- Do not claim an app is downloadable until a verified artifact exists.
- Do not publish third-party apps without distribution permission.
- Do not expose signing keys, Supabase service-role keys or private credentials.
- Do not modify the existing Prynceonline central ecosystem as part of this project.
