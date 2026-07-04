# Update Guide — Ship Feature Changes Without Rebuilding the APK

Mass Power Auto Services is an Expo React Native app. Almost every feature
you asked for (VIN scanner UI, oil-change reminders, WhatsApp messages,
Data Matrix generator, Cloud Sync push/pull, etc.) is written in pure
JavaScript/TypeScript. That means you can push those changes to the phones
that already have the app installed **without rebuilding a new APK from
scratch**, using Expo's **EAS Update** (Over-The-Air / "OTA" updates).

---

## When you can use OTA

✅ **Works for OTA (no rebuild needed):**
- Any UI change (colours, layout, wording, new screens, sticker sizes).
- Business logic (sync flow, oil-reminder rules, VIN duplicate check, etc.).
- Adding tiles to the Backend Management page.
- Updating text templates (Arabic WhatsApp body, receipts, etc.).
- Bug-fixes in `.tsx` / `.ts` files.
- Print HTML changes (guarantee sticker sheet, thermal receipt template).

❌ **Requires a new APK build (no way around it):**
- Anything that changes a **native module or permission**:
  - Installing/removing a native library (e.g. `expo-camera`, `@bwip-js/react-native`, `@react-native-ml-kit/text-recognition`).
  - Adding a new permission to `app.json` (Camera, Microphone, Location, etc.).
- Changing the **app icon**, splash screen or bundle id.
- Bumping the Expo SDK major version.
- Anything under the `plugins` list in `app.json`.

Rule of thumb: if you only edit files in `app/`, `src/`, or assets that
are already bundled, an OTA update is enough. If you edit `app.json` /
`package.json` / add native code, you must rebuild the APK.

---

## Publishing an OTA Update from Emergent

1. **Save & commit** your latest code changes (they're already on disk if
   you can see them in the preview).
2. Click the **Publish** button in the top-right of Emergent.
3. On the first time only, Emergent will ask if you want to enable
   **EAS Update** for the project. Say **Yes** — it wires the runtime so
   installed devices check for updates automatically.
4. After the first APK/IPA build is on the phone, every subsequent Publish
   sends a JavaScript-only bundle to that same channel. The phone downloads
   it silently in the background the next time the app launches.

Behind the scenes Emergent runs the equivalent of:

```
eas update --branch production --message "Sync push/pull buttons + Arabic reminder"
```

You do not need the CLI locally. Emergent handles it.

---

## How the phone picks up the update

- **Background download**: When the user opens the app, the launcher checks
  the EAS Update server for a newer JS bundle on the same branch/channel.
  If one exists it downloads it in the background.
- **Applies on next launch**: The new bundle is applied the *next* time the
  app is opened. If the user is on the current session they keep the old
  code until they close and reopen.
- **No app store review**: For Android APK direct-installs this is instant.
  If you ship the app through the Play Store, JS updates still bypass the
  store review because they're delivered by EAS, not the store.

---

## Rollout plan for the current changes

The changes since the last APK you installed (Cloud Sync, Push/Pull
buttons, Arabic reminder tweaks, bigger 8-sticker sheet, VIN duplicate
protection, inventory price hiding on service screens) are ALL pure
JavaScript. They can go out as an OTA:

```
1. Ensure last APK on the phone has EAS Update enabled (Emergent turns
   this on when you publish once).
2. Click "Publish" -> OTA update pushed to the branch tied to that APK.
3. Close + reopen the app -> new bundle takes effect.
```

If the APK on the phone was built **before** EAS Update was enabled, do
one final rebuild first (Publish -> Generate Android APK). From that point
on all future JS/logic updates are OTA.

---

## Troubleshooting

- **"App did not receive the update"** -> force-close the app twice and
  reopen. The runtime downloads on launch, applies on the second launch.
- **"I see the old sticker layout"** -> same behaviour — close the app
  fully (not just background), reopen, wait 3 seconds, close, reopen.
- **"I get an error about incompatible runtime"** -> you changed a native
  plugin (added expo-camera, changed permissions, etc.). You must
  regenerate the APK once, then OTA works again.

---

## Files that are 100% OTA-safe to edit later

- `app/**/*.tsx` — every screen (management, reminders, qr-generate, …).
- `src/**/*.ts` and `.tsx` — utilities, DB layer, components.
- `assets/**` — only images referenced by URI/require in JS (icons in
  `app.json` still need a rebuild).

## Files that break OTA (require a rebuild)

- `app.json`, `metro.config.js`, `babel.config.js`.
- `package.json` (any dependency add/remove/upgrade).
- Anything under `android/` or `ios/` if those folders exist.
