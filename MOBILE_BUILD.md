# Break Cash Mobile Build

This project is prepared for both Android and iOS using Capacitor.

## App Identity

- App name (English): `Break Cash`
- App name (Arabic): `بريك كاش`
- Bundle ID / Package ID: `com.breakcash.app`

## Android

### Local requirements

- Java JDK installed
- `JAVA_HOME` configured
- Android Studio / Android SDK installed

### Release signing

1. Copy `android/keystore.properties.template` to `android/keystore.properties`.
2. Replace the placeholder values with the real signing values.
3. Place the keystore file inside `android/` or update `storeFile` with the correct path.

### Build commands

```powershell
npm run android:build
npm run android:release
```

Release artifacts are generated under `android/app/build/outputs/`.

## iOS

### Windows preparation

Use this command to create a ready-to-transfer handoff package for a Mac:

```powershell
npm run ios:handoff
```

This creates:

- `build-artifacts/break-cash-ios-handoff.zip`

### On the Mac

1. Extract `break-cash-ios-handoff.zip`.
2. Open `ios/App/App.xcworkspace` in Xcode.
3. Set your Apple Team under Signing & Capabilities.
4. Confirm bundle identifier `com.breakcash.app`.
5. Choose a simulator or device.
6. Build or archive from Xcode.

### iOS command on Mac

```bash
npm install
npx cap sync ios
open ios/App/App.xcworkspace
```

## Notes

- The mobile shell already includes generated icons and splash assets.
- Android and iOS both use the current web build from `dist/`.
- Re-run `npm run build` before any final release if you change the web app.
