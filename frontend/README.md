# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

---

## Application Layout

```
SafeCycle Frontend
│
├─ App Shell
│  ├─ `frontend/app/_layout.tsx`
│  ├─ `react-native-paper` theme provider
│  └─ `DatabaseProvider`
│
├─ Bootstrap / Persistence Setup
│  └─ `frontend/contexts/DatabaseProvider.tsx`
│     ├─ opens `safecycle.db`
│     ├─ runs migrations / creates tables
│     ├─ ensures primary local user exists
│     └─ ensures security settings exist
│
├─ Entry Flow
│  └─ `frontend/app/index.tsx`
│     ├─ splash/logo animation
│     └─ `LockScreen`
│
├─ Security Layer
│  └─ `frontend/components/LockScreen.tsx`
│     ├─ PIN entry / setup
│     ├─ biometric auth
│     ├─ failed-attempt lockout
│     └─ on success -> `router.replace("/(tabs)")`
│
├─ Main Navigation
│  └─ `frontend/app/(tabs)/_layout.tsx`
│     ├─ Home
│     ├─ History
│     └─ Profile
│
├─ Feature Screens
│  ├─ Home: `frontend/app/(tabs)/index.tsx`
│  │  ├─ loads cycle stats
│  │  ├─ loads prediction state
│  │  └─ renders `CycleTracker`
│  │
│  ├─ History: `frontend/app/(tabs)/history.tsx`
│  │  ├─ loads saved periods
│  │  ├─ logs new period starts
│  │  └─ refreshes prediction
│  │
│  └─ Profile: `frontend/app/(tabs)/profile.tsx`
│     ├─ loads user profile
│     ├─ saves name / DOB
│     ├─ saves health conditions
│     └─ saves user intent
│
├─ Hooks / Composition
│  ├─ `frontend/hooks/use-database.ts`
│  └─ `frontend/hooks/use-prediction.ts`
│     ├─ fetches user + conditions + cycle stats
│     ├─ computes age
│     └─ calls prediction engine
│
├─ Domain / Data Access
│  ├─ `frontend/services/dao/UserDao.ts`
│  ├─ `frontend/services/dao/ProfileDao.ts`
│  ├─ `frontend/services/dao/PeriodDao.ts`
│  └─ `frontend/services/dao/CycleDao.ts`
│
├─ Security DAO Layer
│  ├─ `frontend/dao/userDao.ts`
│  └─ `frontend/dao/securityDao.ts`
│
├─ Business Logic
│  └─ `frontend/engine/predictionEngine.ts`
│     ├─ blends personal history + population defaults
│     ├─ adjusts for conditions
│     ├─ computes period/fertility windows
│     └─ returns confidence + range
│
└─ Local Storage
   └─ SQLite tables from `frontend/contexts/schema.js`
      ├─ Users
      ├─ Cycles
      ├─ Periods
      ├─ Entries
      ├─ HealthConditions
      ├─ UserBirthControl
      ├─ UserIntent
      ├─ Predictions
      └─ SecuritySettings
```