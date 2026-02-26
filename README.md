SafeCycle is a privacy focused mobile app designed for tracking menstrual cycles and storing reproductive health information for women. All data is processed locally on the app and can be protected by biometrics and App PIN. Nobody has access to your health data not even us. Privacy is a standard not a suggestion. 

## Technologies:
- Frontend: [React Native + Expo](https://react.dev/#:~:text=React%20Native%20and%20Expo%20let%20you%20build%20apps%20in%20React%20for%20Android%2C%20iOS%2C%20and%20more.)

    - Install Enviornment: [Expo setup guide](https://docs.expo.dev/get-started/set-up-your-environment/?platform=ios&device=physical&mode=expo-go)

## How to run application:

### Frontend:
1) Make sure you're under the correct directory `frontend`
2) Install necessary packages:
    ```bash
    npm install
    ```
3) Start application: 
    ```bash
    npx expo start
    ```

### Backend
1) Ensure you have set up your vitrual python environment `python -m venv .venv`
2) Activate your virtual environment `.venv/bin/activate` or `source .venv/bin/activate` for bash users
3) Update and/or install the required packages via `pip install -r requirements.txt`
4) To test and develop the backend application:
    ```bash
    fastapi dev main.py
    ```
    If you need access beyond your local network enter:
    ```bash
    uvicorn main:app --host 0.0.0.0
    ```

### Frontend Pages:
- Home Page
- History (Overview user data)
- Profile (User, Pass, Scannable QR)

## Note(s):
- App runtime entry is `frontend/package.json` with `"main": "expo-router/entry"`.
- The app boots Expo Router (not `App.jsx` / `index.jsx`).
- Root navigation starts in `frontend/app/_layout.tsx`, then loads tabs from `frontend/app/(tabs)/_layout.tsx`.