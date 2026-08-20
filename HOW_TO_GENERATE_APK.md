# 📱 How to Generate the Release APK

This guide explains how to build a production-ready `.apk` for the Facial Recognition Attendance Mobile App.

## 🛠️ Prerequisites

1. **Flutter SDK**: Ensure you have Flutter installed and on the `stable` channel.
   ```bash
   flutter doctor
   ```
2. **Java & Android SDK**: Ensure Android Studio is installed and the Android SDK is configured properly in your system's PATH.

---

## ⚙️ Steps to Build the APK

### 1. Navigate to the mobile directory
Open your terminal and navigate to the mobile folder of the project:
```bash
cd mobile
```

### 2. Fetch all dependencies
Ensure all Flutter packages and dependencies are downloaded:
```bash
flutter pub get
```

### 3. Configure the API Base URL & Build
The application needs to know where your backend is hosted. 
Set the API URL for the production build by passing `--dart-define=API_BASE_URL="..."`.

**Example for local network testing** (replace with your machine's IP address):
```bash
flutter build apk --release --dart-define=API_BASE_URL="http://192.168.1.100:8000"
```

**Example for a production domain**:
```bash
flutter build apk --release --dart-define=API_BASE_URL="https://api.your-domain.com"
```

### 4. Locate your generated APK
Once the build command completes successfully, your compiled `.apk` file can be found at the following path:
```text
build/app/outputs/flutter-apk/app-release.apk
```

---

## 🚀 Distributing the App
You can now transfer this `app-release.apk` directly to Android devices for sideloading or prepare it for internal distribution tracks (e.g. Google Play Console internal testing).

> **Note**: For official Play Store release, you would need to build an App Bundle (`.aab`) instead of an `.apk` by running `flutter build appbundle`.
