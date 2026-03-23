# 📺 NetCastApp

My LG TV remote waved its final goodbyes, so I built an AD-FREE alternative app!

NetCast is a cross-platform mobile app built with React Native that turns your phone into a lightning-fast, fully functional smart TV remote. 

## ✨ Features

* **iOS & Android Ready:** Control your TV from any phone.
* **Instant Reconnects:** Silently re-establishes the connection when you bring the app back from the background. 
* **Haptic Feedback:** Satisfying physical responses when you tap buttons.
* **It Remembers You:** Securely saves your TV's IP address, Session ID, and PIN so you never have to pair it twice.

## 🚀 Getting Started

### Android Setup
Go to [releases](https://github.com/nihvp/NetCastApp/releases), download and install the latest .apk file

---

### iOS Setup
Want to run this locally? Make sure you have your React Native environment set up (Node, Watchman, and Xcode).

Clone & Install
```bash
git clone https://github.com/your-username/NetCastApp.git
cd NetCastApp
npm install
```
Setup App

```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

## 🛠️ Tech Stack
* **Framework:** React Native
* **Storage:** `@react-native-async-storage/async-storage`
* **Network:** `react-native-udp`
* **UI/UX:** `react-native-haptic-feedback`, `react-native-safe-area-context`

---
*Built with ❤️ (and a lot of Gradle troubleshooting).*

