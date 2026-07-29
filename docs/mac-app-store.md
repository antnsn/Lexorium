# Mac App Store distribution

Manual pipeline that builds, signs, packages, and uploads the **Tauri** Lexorium
app to App Store Connect (and, automatically, TestFlight for macOS).

Triggered by **Actions → Mac App Store → Run workflow** (`workflow_dispatch`).

---

## Why this is NOT the "Strain" cloud-signing pipeline

The iOS Strain pipeline uses **xcodebuild cloud signing**: `-allowProvisioningUpdates`
plus an Admin ASC API key mints the distribution certificate and provisioning
profile on the fly, so no certs/profiles live in the repo.

**That is an xcodebuild-only feature.** Lexorium is a Tauri app — it is built by
the Tauri bundler and signed with local `codesign`/`productbuild`, which cannot
do cloud signing. So for Lexorium:

| Concern | Strain (iOS, xcodebuild) | Lexorium (Tauri, macOS) |
|---|---|---|
| App signing | cloud-minted, automatic | **Apple Distribution cert** in keychain (secret) |
| Installer signing | n/a (.ipa) | **Mac Installer Distribution cert** in keychain (secret) |
| Provisioning profile | minted by ASC key | **supplied as a secret**, embedded into `.app` |
| ASC API key role | mints certs → must be **Admin** | upload only → **App Manager is enough** |
| Package format | `.ipa` | `.pkg` (`productbuild`) |
| ExportOptions.plist | yes | **n/a** — no xcodebuild export step |
| Committed `.xcscheme` | yes | **n/a** — no Xcode project/scheme |

`ExportOptions.plist` and a shared scheme were in the original request but do not
exist for a Tauri build; the Tauri bundler replaces both. They are intentionally
omitted.

What still carries over conceptually: ASC API key for upload, App Sandbox +
Hardened Runtime entitlements, `ITSAppUsesNonExemptEncryption=false`, build
number from `github.run_number`, and "App Store uploads need no notarization".

---

## One-time human prerequisites (not scriptable)

1. **Active Apple Developer Program** membership.

2. **Register the App ID** — Developer portal → Identifiers → new App ID,
   bundle id `com.antnsn.lexorium`, platform macOS. The Tauri app is a single
   target with **no helper / XPC / login-item bundles**, so only this one App ID
   is needed. (If helpers are ever added, each needs its own App ID or its
   profile won't generate.)

3. **Create the App Store app record** — App Store Connect → Apps → new macOS
   app, bundle id `com.antnsn.lexorium`.

4. **Create two distribution certificates** (Developer portal → Certificates):
   - **Apple Distribution** — signs the `.app`.
   - **Mac Installer Distribution** (a.k.a. "3rd Party Mac Developer Installer")
     — signs the `.pkg`.
   Export each from Keychain Access as a password-protected `.p12` (include the
   private key).

5. **Create a Mac App Store provisioning profile** for `com.antnsn.lexorium`
   tied to the Apple Distribution cert. Download the `.provisionprofile`.

6. **Create an ASC API key** — App Store Connect → Users and Access → Integrations
   → App Store Connect API → generate key. **App Manager** role suffices here
   (this pipeline does not mint certs). Download the `.p8` **once**.

7. **Set the GitHub secrets** below.

---

## GitHub secrets

Set under **Settings → Secrets and variables → Actions**.

| Secret | What | How to produce |
|---|---|---|
| `APPLE_TEAM_ID` | 10-char Team ID | Developer portal → Membership |
| `APPLE_DIST_CERT_P12` | Apple Distribution cert+key, base64 | `openssl base64 -A -in dist.p12 \| tr -d '\n'` |
| `APPLE_INSTALLER_CERT_P12` | Installer cert+key, base64 | `openssl base64 -A -in installer.p12 \| tr -d '\n'` |
| `APPLE_CERT_PASSWORD` | password used when exporting both `.p12`s | — |
| `MAS_PROVISION_PROFILE_BASE64` | the `.provisionprofile`, base64 | `openssl base64 -A -in app.provisionprofile \| tr -d '\n'` |
| `ASC_KEY_ID` | ASC API key id | shown next to the key |
| `ASC_ISSUER_ID` | ASC issuer id | top of the API keys page |
| `ASC_API_KEY_P8` | the `.p8`, single-line base64 | `openssl base64 -A -in AuthKey_XXX.p8 \| tr -d '\n'` |

> Always decode with `openssl base64 -d -A`, never `base64 --decode`
> (GNU-only; fails on the runner's BSD `base64`). Store every secret single-line.

---

## What the workflow does

`.github/workflows/mas.yml`:

1. Checkout → pin Xcode (`maxim-lobanov/setup-xcode`, 26.5) → Node + Rust
   (universal targets) → `npm ci`.
2. Import both `.p12`s into a throwaway keychain; install the provisioning profile.
3. Compose final entitlements: the committed `app/src-tauri/entitlements.plist`
   plus `com.apple.application-identifier` and `com.apple.developer.team-identifier`
   (added at sign time so the Team ID stays out of the repo).
4. `tauri build --target universal-apple-darwin --bundles app`.
5. Set `CFBundleVersion = github.run_number`; embed the provisioning profile;
   `codesign` with Hardened Runtime (`--options runtime`) + entitlements;
   `productbuild` a signed `.pkg`.
6. `xcrun altool --validate-app` then `--upload-app` with the ASC API key.

Marketing version (`CFBundleShortVersionString`) comes from `version` in
`tauri.conf.json` (currently `4.0.0`) — bump it manually for a public release.
The build number auto-increments via the run number.

---

## Entitlements (committed)

`app/src-tauri/entitlements.plist` declares only what the app uses:

- `com.apple.security.app-sandbox` — **required** by the Mac App Store.
- `com.apple.security.network.client` — AI commands (`src/commands/ai.rs`) call HTTPS.
- `com.apple.security.files.user-selected.read-write` — Open/Save document dialogs.

The entitlements are **not** wired into `tauri.conf.json` (`bundle.macOS.entitlements`)
on purpose: that would sandbox every macOS build (dmg, Homebrew), breaking the
recent-files/last-opened flow for direct-distribution users. The MAS workflow
re-signs with these entitlements explicitly, so only MAS builds are sandboxed.

Known MAS-build limitation: recent files / last-opened restore store plain paths
without security-scoped bookmarks, so a sandboxed build cannot reopen them after
restart until the user picks the file again via the open dialog. Fixing this
needs `com.apple.security.files.bookmarks.app-scope` plus bookmark persistence
in the Rust document commands.

Hardened Runtime is applied at sign time (`codesign --options runtime`).
If you add a capability (e.g. printing, a helper, persisted file bookmarks), add
the matching entitlement here — declaring unused ones can trigger rejection.

`app/src-tauri/Info.plist` (merged by Tauri) sets
`ITSAppUsesNonExemptEncryption=false` to skip the per-upload export-compliance
prompt (valid because the app uses only standard HTTPS).

---

## After a green run

- The job ends at `altool --upload-app` reporting success.
- The build appears in **App Store Connect → your app → TestFlight** (macOS)
  after Apple finishes processing (a few minutes). From there assign testers or
  submit for review. No notarization step is needed for App Store builds.

## Common first-run failures

- **No identity found** → the `.p12` lacked its private key, or the wrong cert
  type was exported. Re-export including the key.
- **Profile doesn't match** → the provisioning profile's App ID/cert must match
  `com.antnsn.lexorium` and the Apple Distribution cert in the dist `.p12`.
- **Invalid Bundle / sandbox** → confirm `com.apple.security.app-sandbox` is in
  the signature (`codesign -d --entitlements - "$APP"`).
