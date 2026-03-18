# 📺 NetCast

My TV remote went to get milk, so had to built an AD-FREE alternative from scratch

NetCast is a cross-platform mobile app built with React Native that turns your phone into a lightning-fast, fully functional smart TV remote. 

## ✨ Features

* **🍎🤖 iOS & Android Ready:** Control your TV from any phone.
* **⚡ Instant Reconnects:** Silently re-establishes the connection when you bring the app back from the background. 
* **📳 Haptic Feedback:** Satisfying physical responses when you tap buttons.
* **🧠 It Remembers You:** Securely saves your TV's IP address, Session ID, and PIN so you never have to pair it twice.

## 🚀 Getting Started

Want to run this locally? Make sure you have your React Native environment set up (Node, Watchman, Xcode, and Android Studio).

### 1. Clone & Install
```bash
git clone https://github.com/your-username/NetCastApp.git
cd NetCastApp
npm install
```

### 2. iOS Setup
```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

### 3. Android Setup
```bash
npx react-native run-android
```
*(Note: If you are building the release APK, you will need to set up your own production keystore.)*

## 🛠️ Tech Stack
* **Framework:** React Native
* **Storage:** `@react-native-async-storage/async-storage`
* **Network:** `react-native-udp`
* **UI/UX:** `react-native-haptic-feedback`, `react-native-safe-area-context`

---
*Built with ❤️ (and a lot of Gradle troubleshooting).*

