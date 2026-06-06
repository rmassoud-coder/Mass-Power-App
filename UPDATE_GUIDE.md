# 🔄 How to Update Your APK
## Quick Reference - Mass Power Auto Services

After making changes in Emergent, follow these steps to get the updates onto your phone.

**Total time: ~15-20 minutes per update**

---

## 📋 The 5-Step Update Process

### ✅ Step 1: Save Changes from Emergent to GitHub

1. In **Emergent**, look at the **TOP RIGHT** corner
2. Click the **"Save to GitHub"** button
3. Wait for the green **"Saved successfully"** message (~10 seconds)

That's it for Emergent! Your changes are now on GitHub.

---

### ✅ Step 2: Pull Changes to Your PC

1. Press `Windows Key + R`, type `cmd`, press Enter
2. Run these commands:

```cmd
cd C:\MPapp
```

```cmd
git pull
```

You'll see something like:
```
Updating abc123..def456
Fast-forward
 frontend/app/home.tsx | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)
```

If you see **"Already up to date"** → no changes to download (skip remaining steps)

---

### ✅ Step 3: Update Dependencies (Only if Needed)

**Only do this if Step 2 mentioned files like `package.json` or `yarn.lock`.**

If yes, run:
```cmd
cd C:\MPapp\frontend
```

```cmd
npm install
```

Wait 2-3 minutes.

**If Step 2 didn't mention package.json, SKIP this step.**

---

### ✅ Step 4: Build New APK

```cmd
cd C:\MPapp\frontend
```

```cmd
eas build --platform android --profile preview
```

- If it asks about keystore → press `Y`
- Wait 10-15 minutes ⏳

When done, you'll see a URL like:
```
https://expo.dev/accounts/yourname/projects/mass-power-app/builds/xyz123
```

---

### ✅ Step 5: Install on Phone

**Option A: Direct on Phone (Fastest)**
1. Open the build URL on your PC browser
2. Scan the QR code with your phone's camera
3. Tap the notification → APK downloads
4. Tap the APK → tap **"Install"** → tap **"Update"** (if it asks)
5. Done! Your data stays intact 🎉

**Option B: Via PC**
1. Click **"Install"** button on the build page (PC browser)
2. APK downloads to your PC's Downloads folder
3. Transfer to phone (USB / WhatsApp / Email)
4. On phone, tap the APK → **"Install"**

---

## ⚡ Super Quick Reference (Copy/Paste All)

If you're confident there were code changes, run all of this at once:

```cmd
cd C:\MPapp && git pull && cd frontend && npm install && eas build --platform android --profile preview
```

This does everything in one go. Wait 15-20 min, then install the APK.

---

## 🆘 Common Issues During Updates

### "Already up to date" but I made changes in Emergent
→ You forgot to click **"Save to GitHub"** in Emergent. Go back to Step 1.

### "ECONNRESET" or network error during build
→ Just run the build command again. Expo servers occasionally hiccup.

### Build fails with image errors
→ Check the build URL logs. If it mentions icons not being square or missing splash, contact me.

### "App not installed" on phone
→ Some Android phones reject APKs signed with different keystores. Try:
1. **Settings** → **Apps** → **Mass Power Auto Services** → **Uninstall**
2. Install the new APK fresh
3. ⚠️ **You lose local data** unless you backed up first via the app's Backup & Restore screen

### Phone says "Update failed"
→ Older APK is blocking. Uninstall first, then install new APK.

---

## 💾 IMPORTANT: Before Major Updates

If you've added important customer data, **back it up first!**

1. Open the app on your phone
2. Tap **"Backup & Restore"** button (home screen)
3. Tap **"Export Backup"**
4. Save the file to Google Drive / Email yourself
5. **NOW** install the new APK
6. If anything goes wrong, use **"Choose Backup File"** to restore

---

## 📅 Free Tier Limits

Expo gives you **30 free builds per month**. Each `eas build` command counts as 1 build.

If you build daily, you'll hit the limit. Solutions:
- Build only when you have meaningful changes (save up multiple changes)
- Or upgrade Expo to $29/month for unlimited builds

---

## 🎯 Visual Summary

```
   [Emergent]              [GitHub]              [Your PC]              [Phone]
       │                      │                      │                      │
       ▼                      ▼                      ▼                      ▼
  Make changes ──→ Save to GitHub ──→ git pull ──→ eas build ──→ Install APK
                                                                            │
                                                                            ▼
                                                                       Use App! 🚗
```

---

## 📞 Need Help?

If something doesn't work:
1. Note the EXACT error message (screenshot helps!)
2. Note which step failed
3. Send to me with that info

---

## ✅ Update Checklist (Tick as you go)

For each update, follow this checklist:

- [ ] Step 1: Clicked "Save to GitHub" in Emergent
- [ ] Step 2: Ran `git pull` on PC
- [ ] Step 3: Ran `npm install` (only if dependencies changed)
- [ ] Step 4: Built with `eas build --platform android --profile preview`
- [ ] Step 5: Installed APK on phone
- [ ] Verified app opens and data is still there ✅

---

**🎉 That's it! 15-20 minutes from "saved in Emergent" to "running on phone".**

🚗 *Mass Power Auto Services - Built for the long haul!*
