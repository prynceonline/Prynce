# ACTIVE app release checklist

An app listing and an installable Android release are different things. A listing may be visible while its Android release remains unavailable.

## Required release record

Every Android release must include:

- App name, stable listing ID, developer/publisher identity and support contact.
- Package/application ID, version name, version code, minimum Android API and supported device types.
- APK or AAB artifact, file size and SHA-256 checksum.
- Signing certificate fingerprint and verified continuity with earlier releases.
- Source repository URL, source commit/tag, build instructions and licence.
- Privacy policy URL, permissions summary, data-safety declaration and support URL.
- Release notes, upload date and moderation state.

## Review sequence

1. Accept uploads into a private quarantine area; never serve directly from the upload bucket.
2. Validate MIME type, package structure, package ID, version and signing certificate.
3. Scan with open-source mobile security analysis such as MobSF and malware scanning such as ClamAV; treat scanner results as signals, not a guarantee of safety.
4. Review requested permissions, embedded SDKs, trackers, network endpoints and privacy disclosures.
5. Confirm distribution rights and open-source licence obligations.
6. Produce a release record with SHA-256 and signed repository metadata.
7. Require an authorized reviewer to approve publication.
8. Re-scan and re-verify every update; preserve previous signed releases for rollback.

## Non-negotiable controls

- Never publish apps from unknown or unauthorized sources.
- Never claim that a scan proves an app is completely safe.
- Never alter an APK after signature verification.
- Never allow a package signing key to be uploaded as an app artifact.
- Keep repository signing keys offline or in a protected signing environment.
- Never commit Supabase service-role keys, signing keys, passwords or tokens.
- Provide a takedown and vulnerability-reporting contact.
- Keep a complete audit trail of submissions, decisions and releases.
