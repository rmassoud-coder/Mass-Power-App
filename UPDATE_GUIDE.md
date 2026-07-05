# Update Guide — Delivering Changes to a Phone Without Rebuilding Every Time

> **TL;DR — There is no "delta / patch APK" for a sideloaded Android app.
> Once we finish one more full APK rebuild that includes `expo-updates`,
> every future JavaScript / UI / business-logic change ships as a
> **~1–3 MB OTA bundle** instead of a **~40 MB APK**. Native changes
> (new permissions, new native modules, icon changes) still require a
> full APK — there is no way around that on Android.**

---

## Why the previous OTA update did NOT reach the phone

The APK that's currently installed on the phone was built **before**
`expo-updates` was in the project. Without that native module, the phone
has no runtime to poll for JavaScript updates. That's why nothing arrived
after the last Publish.

I've now added `expo-updates@29.0.18` to the project and configured
`app.json` with `runtimeVersion.policy = "appVersion"` and
`updates.enabled = true, checkAutomatically = ON_LOAD`. Once you do
**one more rebuild** with these changes baked in, the story completely
flips.

---

## What each type of update actually costs after the next rebuild

| Change type                         | Delivery                          | Rough size | User action              |
|-------------------------------------|-----------------------------------|-----------|-------------------------|
| Any `.tsx` / `.ts` code change      | OTA (EAS Update)                  | 1–3 MB    | Close & reopen app       |
| Print HTML / sticker layout tweaks  | OTA                               | 1–3 MB    | Close & reopen app       |
| Wording / Arabic text tweaks        | OTA                               | < 1 MB    | Close & reopen app       |
| Image inside `assets/` used by JS   | OTA                               | 1–3 MB    | Close & reopen app       |
| New JS-only package (`yarn add`)    | OTA                               | 1–5 MB    | Close & reopen app       |
| **New native module** (camera, ML, printer) | **Full APK rebuild**    | 30–50 MB  | Reinstall APK            |
| **New Android permission**          | **Full APK rebuild**              | 30–50 MB  | Reinstall APK            |
| App icon / splash / bundle-id       | **Full APK rebuild**              | 30–50 MB  | Reinstall APK            |

So the **average update is 1–3 MB, not 40 MB**, once expo-updates is on
the phone.

---

## Can Android just ship a "patch APK" like Windows patches?

Short answer: **not for sideloaded APKs**. The mechanisms that produce
"smaller" APKs exist only in one of these forms:

1. **Google Play delta / bsdiff patches** — only work when the app is
   installed **through the Play Store**. Sideloaded (direct-install) APKs
   always come as one whole file.
2. **Android App Bundle (`.aab`) with dynamic delivery** — Play Store
   splits the bundle per architecture / density and only delivers what
   the phone needs. Again, Play-only.
3. **APK Split by ABI** — reduces initial APK size (e.g. ~28 MB instead
   of ~50 MB for arm64-only) but is still a full install each time.
4. **Expo Updates / EAS Update (OTA)** — the JavaScript bundle only, ~1–3
   MB. This is what we're setting up now. The **APK itself does not
   change**; the app fetches the new JS at startup and swaps it in.

Option 4 is the only real "smaller update" path for a direct-install
Android app. That's why I re-enabled it properly.

---

## What YOU need to do — one time only

1. **Regenerate the APK once more with expo-updates baked in.**
   - In Emergent, click **Publish** → **Generate Android APK**.
   - The build will take a few minutes. Install the resulting APK on the
     phone the usual way. This is the last "big" install.
2. **Confirm updates are live** (optional sanity check).
   - After installing, open the app. Navigate to Backend Management. If
     the runtime is armed, subsequent Publishes will be picked up on the
     next launch.

From this point forward:

3. **For every future JS/UI/logic change**:
   - Click **Publish** in Emergent (top-right).
   - Emergent runs `eas update --branch production` behind the scenes.
   - Open the app on the phone → the phone downloads the ~1–3 MB bundle
     silently in the background → close and reopen once → the new
     version is running.
   - No new APK, no reinstall.
4. **For a native change** (rare — new sensor library, new permission,
   etc.):
   - Click Publish → Generate Android APK.
   - Install the fresh APK once. Then future JS updates continue as OTA
     on top of that.

---

## Troubleshooting

- **"I published but nothing arrived on the phone"**
  - Confirm the phone is running the **new** APK that has expo-updates
    (the one built AFTER this guide). Old APKs will never pick up an OTA
    because they don't know how to look.
  - Close the app **twice** and reopen — the download happens on launch,
    the swap happens on the launch after.
- **"App shows an error about incompatible runtime version"**
  - You changed a native module or bumped `runtimeVersion`. Rebuild the
    APK once and you're back on the OTA train.
- **"Sync now doesn't work"**
  - That's the in-app **data** sync (Backend Management → Cloud Sync
    Push/Pull), not the app-code sync. Check that a GitHub Personal
    Access Token is saved in Settings → Cloud Backup, and that
    `githubOwner`, `githubRepo`, `githubBranch`, `githubFolder` are all
    filled in.

---

## Summary

- **OTA didn't work because expo-updates was missing.** Fixed now.
- **You still need ONE more full APK rebuild** to put the update runtime
  onto the phone. Publish → Generate Android APK → install.
- **After that**, every future feature/bug-fix/tweak I ship is delivered
  as a **~1–3 MB OTA** in seconds, not a 40 MB APK.
- **There is no "patch APK"** for sideloaded Android — that's a Play
  Store feature you don't get with direct APK installs.
