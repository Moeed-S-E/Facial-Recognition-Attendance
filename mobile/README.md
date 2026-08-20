# Facial Recognition Attendance - Mobile App

The Mobile application is built with **Flutter** and is designed primarily for employees. It provides a seamless, secure, and intuitive interface for capturing daily attendance, verifying identity via camera checks, and reviewing personal attendance history.

## Key Technologies
- **Flutter**: Cross-platform UI toolkit.
- **Dart**: Programming language.
- **Camera integration**: For on-device capture quality checks (framing, lighting).

## Prerequisites
- Flutter SDK (stable channel)
- Android Studio / Xcode (for emulation/device testing)

## Local Development Setup

1. **Fetch dependencies:**
   ```bash
   cd mobile
   flutter pub get
   ```

2. **Run the application:**
   Connect a device or start an emulator, then run:
   ```bash
   flutter run
   ```

3. **Testing:**
   ```bash
   flutter test
   ```

## Key Features
- **Attendance Capture:** Employees can securely check in and check out.
- **On-Device Quality Checks:** Before any image is uploaded, the app checks lighting and framing locally to ensure a valid capture.
- **Realtime Updates:** Listens for backend state changes to reflect immediate attendance confirmations.

## Note on Privacy
The mobile app never stores biometric templates. Images are uploaded to the backend solely as evidence (if allowed by organization policy) and are subject to immediate deletion under `local-only` retention modes.
