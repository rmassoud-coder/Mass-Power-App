# 📱 IDIOT-PROOF APK Build Guide
## Mass Power Auto Services - Step by Step

Total time: ~45-60 minutes the first time, ~15 minutes after that.

---

## 🛠️ PART 1: Install Required Software (One-Time Setup)

### Step 1.1: Install Node.js
1. Open your web browser
2. Go to: **https://nodejs.org**
3. You'll see two green buttons. Click the one on the **LEFT** that says **"LTS"** (recommended for most users)
   - 📸 *What you see: A page with two big green download buttons. The LEFT one says "LTS" with a version number*
4. A file will download named something like `node-v20.x.x-x64.msi`
5. Double-click the downloaded file
6. Click **"Next"** through all screens, keep all defaults
7. Click **"Install"** at the end
8. Click **"Finish"** when done

**✅ Verify it worked:**
1. Press `Windows Key + R`
2. Type `cmd` and press Enter (a black window opens)
3. Type: `node --version` and press Enter
4. You should see something like `v20.11.0`
   - 📸 *What you see: Black window showing "v20.11.0" or similar version number*
5. Type: `npm --version` and press Enter — should show something like `10.2.4`

❌ **If you see "not recognized"**: Restart your computer and try again.

---

### Step 1.2: Install Git
1. Open browser, go to: **https://git-scm.com/download/win**
2. Download will start automatically
3. Run the downloaded file
4. Click **"Next"** through ALL screens (keep all defaults — don't change anything)
5. Click **"Install"** at the end
6. Click **"Finish"**

**✅ Verify:** Open a NEW Command Prompt window (close the old one first), type `git --version` — should show a version number.

---

### Step 1.3: Create a Free Expo Account
1. Open browser, go to: **https://expo.dev/signup**
2. You'll see a signup form
3. Enter:
   - Your email address
   - A password (write it down! you'll need it)
   - A username
4. Click **"Create Account"**
5. Check your email and click the verification link
6. Done! Now you have a free Expo account.

**📝 Write down your username and password!** You'll need them in Step 5.

---

### Step 1.4: Create a Free GitHub Account (if you don't have one)
1. Open browser, go to: **https://github.com/signup**
2. Enter email, create password, pick a username
3. Verify your email
4. Done!

---

## 🚀 PART 2: Get Your Code

### Step 2.1: Save Your Code to GitHub
1. Open your Emergent app project in the browser
2. Look at the **TOP RIGHT corner** of the Emergent screen
3. Click the button that says **"Save to GitHub"** (looks like a GitHub octopus logo)
   - 📸 *What you see: A small button labeled "Save to GitHub" near the top right area of Emergent*
4. A dialog appears asking you to connect your GitHub account
5. Click **"Authorize"** when GitHub asks
6. Choose **"Create new repository"**
7. Type a name like: `mass-power-app`
8. Choose **"Private"** (recommended)
9. Click **"Save"** or **"Push"**
10. Wait ~30 seconds. You'll see a success message with the GitHub URL.
11. **Copy that URL!** It looks like: `https://github.com/YOUR_USERNAME/mass-power-app`

---

### Step 2.2: Clone the Code to Your PC
1. Press `Windows Key + R`
2. Type `cmd` and press Enter
3. Type these commands one at a time, pressing Enter after each:

```cmd
cd C:\Users\%USERNAME%\Desktop
```
(This puts you on your Desktop)

```cmd
git clone https://github.com/YOUR_USERNAME/mass-power-app.git
```
(REPLACE the URL with the one YOU copied in Step 2.1)

📸 *What you see: Lines like "Cloning into 'mass-power-app'..." then "done."*

4. Now type:
```cmd
cd mass-power-app
```

5. You should see your prompt change to show `mass-power-app` at the end. ✅

---

## 🧩 PART 3: Install Project Dependencies

### Step 3.1: Install Yarn and EAS CLI
In the same command window, run:

```cmd
npm install -g yarn eas-cli
```

⏳ Wait 2-3 minutes. You'll see lots of text scrolling — that's normal.

✅ When it stops scrolling and shows a new prompt, it's done.

---

### Step 3.2: Install Project Packages
```cmd
cd frontend
```
(This enters the frontend folder)

```cmd
yarn install
```

⏳ Wait 3-5 minutes. Again, lots of text. Just wait.

📸 *What you see: Progress bars, package names, finally "Done in X seconds"*

---

## 🔧 PART 4: Configure for Offline Use

Your app is already configured for offline mode (no backend needed). But let me make sure your `.env` file is right.

### Step 4.1: Check the .env file
1. Open File Explorer
2. Navigate to: `Desktop\mass-power-app\frontend`
3. Look for a file called `.env` (it might be hidden — turn on "Show hidden files" in View menu)
4. **Right-click → Open with → Notepad**
5. You'll see something like:
```
EXPO_TUNNEL_SUBDOMAIN=mechanic-search-3
EXPO_PACKAGER_HOSTNAME=...
EXPO_PUBLIC_BACKEND_URL=https://mechanic-search-3.preview.emergentagent.com
```
6. **No changes needed!** Since your app is fully offline now, the backend URL is only used for VIN decoder (which needs internet). Leave it alone.
7. Close Notepad.

---

## 🔑 PART 5: Login to Expo (in Command Prompt)

Back in your command window, type:

```cmd
eas login
```

It will ask:
- **Email or username:** Type the username you created in Step 1.3
- **Password:** Type your password (you won't see it as you type — that's normal)

✅ You'll see: `Logged in as YOUR_USERNAME`

---

## ⚙️ PART 6: Configure EAS Build

```cmd
eas build:configure
```

It will ask several questions:
- **"Which platforms would you like to configure for EAS Build?"**
  - Use arrow keys to select **"Android"** → press SPACEBAR → press ENTER
- **"Would you like automatically create an EAS project for @yourusername/mass-power-app?"**
  - Type `Y` and press Enter

📸 *What you see: A new file `eas.json` is created in your folder*

---

## 🎁 PART 7: Build the APK!

This is the magic step. Run:

```cmd
eas build --platform android --profile preview
```

It will ask:
- **"Generate a new Android Keystore?"**
  - Type `Y` and press Enter
  - (Expo will manage the keystore for you - no need to remember anything)

⏳ **Now wait 10-20 minutes.** You'll see:
1. "Uploading to EAS Build..."
2. "Build queued..."
3. "Build in progress..."
4. Finally: A URL like `https://expo.dev/accounts/yourusername/projects/mass-power-app/builds/abc123`

📸 *What you see at the end: A clickable URL and "Build finished" message*

---

## 📥 PART 8: Download Your APK

### Step 8.1: Open the Build URL
1. **Hold CTRL** and click the URL in the command window (or copy/paste into browser)
2. You'll land on the Expo dashboard showing your build
   - 📸 *What you see: A page with green "BUILD FINISHED" badge, a download icon, and a QR code*

### Step 8.2: Download on Your PC
1. Click the **"Install"** button OR the **download icon**
2. A file named like `mass-power-app-xxx.apk` downloads to your Downloads folder
3. Copy this file to your Android phone using any of these methods:
   - **USB cable** (drag to phone's Downloads folder)
   - **Email** to yourself, open on phone
   - **Google Drive** upload, download on phone
   - **WhatsApp** to yourself

### Step 8.3 ALTERNATIVE: Download Directly on Phone
1. On your phone, scan the QR code shown on the Expo build page (using camera app)
2. The APK downloads directly to your phone

---

## 📲 PART 9: Install APK on Your Android Phone

### Step 9.1: Allow Unknown Apps
1. On your phone, open **Settings**
2. Search for **"Install unknown apps"** (or "Unknown sources")
3. Tap **Chrome** (or whatever app you used to download)
4. Toggle **"Allow from this source"** to ON
   - 📸 *What you see: A toggle switch that turns blue/green when ON*

### Step 9.2: Install
1. Open your phone's **Files** or **Downloads** app
2. Find the `.apk` file
3. Tap it
4. Tap **"Install"**
5. Wait 10 seconds
6. Tap **"Open"** or **"Done"**

### Step 9.3: Done! 🎉
The **Mass Power Auto Services** icon appears on your home screen!

📸 *What you see: Your app icon among other apps. Tap to open. No internet needed (except VIN decoder).*

---

## 🔄 Updating the App Later

When you make changes in Emergent:

```cmd
cd C:\Users\%USERNAME%\Desktop\mass-power-app
git pull
cd frontend
eas build --platform android --profile preview
```

That's it! Download the new APK, install over the old one — your data stays intact.

---

## 🆘 Troubleshooting Common Issues

### "command not found: eas" / "command not found: yarn"
- **Fix:** Close ALL command prompt windows, open a new one, try again
- If still broken, restart your PC

### "git: command not found"
- **Fix:** Git wasn't installed properly. Re-run Step 1.2

### Build fails with "Plugin error"
- **Fix:** In your command window:
```cmd
cd C:\Users\%USERNAME%\Desktop\mass-power-app\frontend
yarn install
eas build --platform android --profile preview
```

### "Network error" during build
- **Fix:** Your internet is slow. Wait 5 minutes and try again

### Phone says "App not installed"
- **Fix:** You already have a different version installed. Uninstall the old one first, then install the new APK

### Free tier ran out (30 builds/month)
- **Fix:** Wait until next month, OR pay Expo $29/month for unlimited builds
- **OR:** Build less often — only when you have real changes

---

## ✅ Quick Reference Card

After everything is set up once, this is all you do for future updates:

```cmd
cd C:\Users\%USERNAME%\Desktop\mass-power-app
git pull
cd frontend
eas build --platform android --profile preview
```

Wait for the build, download the APK, install on phone. Done!

---

## 💡 Pro Tips

1. **Bookmark this guide** so you can reference it later
2. **Don't delete the `mass-power-app` folder** from your Desktop — you need it for future builds
3. **Save the QR code** from the Expo build page — it stays valid for 30 days
4. **Build at night** when your internet is faster
5. **Test on Expo Go first** (instant, no build needed):
   - In your code folder, run `yarn start --tunnel`
   - Install "Expo Go" on your phone from Play Store
   - Scan the QR code that appears in command window
   - App loads instantly for testing

---

## 🎉 You Did It!

If you followed all 9 parts, you now have:
- ✅ A working APK installed on your Android phone
- ✅ The ability to rebuild any time with one command
- ✅ Zero monthly costs (free tier covers your needs)
- ✅ Full offline operation at your garage

Need help? The error messages usually tell you what's wrong — Google the exact error text and you'll find solutions.

🚗 **Welcome to Mass Power Auto Services - on your phone, your way!**
