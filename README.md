# 🚀 API Testing Tool — Frontend

A lightweight and modern API testing interface built using React and Vite.  
Designed for fast API exploration, request collections, history tracking, and Firebase-based authentication.

## Live Application: https://srpapitestingtool.netlify.app/

## 🎯 What This Project Is

This frontend application allows users to send API requests, inspect responses, save request collections, and manage request history through a clean and responsive UI.

Built for developers who want a simple Postman-like experience directly in the browser.

## 🧰 Tech Stack

- Framework: React
- Build Tool: Vite
- Styling: Tailwind CSS
- Authentication: Firebase Auth
- Database: Firebase Firestore
- Code Editor: Ace Editor (react-ace)
- Routing: react-router-dom

## 📂 Project Structure

Root files:
- package.json
- vite.config.js
- index.html
- README.md
- .envexample

Source directory (src):
- src/main.jsx — Application entry point and routing
- src/App.jsx — Core UI, request builder, collections, history, sendRequest logic
- src/firebase.js — Firebase initialization, exports auth and db
- src/auth/ — Login, Signup, ForgotPassword, ResetPassword pages
- src/components/ — UI components (HeadersSection, ParamsSection, CollectionsSidebar, HistorySidebar, MobileTabs)
- src/utils/ — Helper utilities (collections.js, history.js, logUserEvent.js)

## 🚀 Getting Started

### Step 1: Install dependencies

npm install

### Step 2: Create environment file

Copy the example env file and update values.

cp .envexample .env

On Windows PowerShell:

Copy-Item .envexample .env

### Step 3: Run the development server

npm run dev

### Step 4: Open in browser

http://localhost:5173  
(or the URL printed by Vite)

## 🔐 Environment Variables

This project uses Vite environment variables.  
All variables **must start with `VITE_`** to be accessible in the browser.

Firebase-related variables required:

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_MEASUREMENT_ID

Backend configuration:

- VITE_API_BASE_URL — URL of the backend proxy server

After changing `.env`, always restart the dev server.

## 📜 Available Scripts

- npm run dev — Run local development server
- npm run build — Build production bundle
- npm run preview — Preview production build locally

## ✨ Features

- Send API requests (GET, POST, PUT, DELETE)
- Save requests and organize them into collections
- Request history sidebar
- Firebase authentication (Signup, Login, Password Reset)
- Mobile-friendly responsive UI
- JSON response viewer with prettify support
- Headers and query parameters editor
- Request body editor using Ace Editor

## 🔌 Backend Integration

The frontend communicates with a backend proxy server.

API requests are sent to:

${VITE_API_BASE_URL}/proxy

If not set, it defaults to:

http://localhost:5000

## 🔁 Core Request Flow

The sendRequest function in src/App.jsx:

- Builds a payload with URL, method, headers, and optional body
- Sends a POST request to the backend proxy
- Receives response data, headers, status, and response time
- Displays formatted response to the user
- Optionally saves request to Firestore

Example proxy payload:

{
  "url": "https://api.example.com/data?x=1",
  "method": "GET",
  "headers": { "Accept": "application/json" },
  "body": null
}

## 🗂️ Collections and History (Firestore)

Firestore structure:

- users/{uid}/collections
- users/{uid}/collections/{collectionId}/requests/{requestId}

Utilities handling Firestore logic:

- src/utils/collections.js — create, add, load collections
- src/utils/history.js — store and retrieve request history

## 🔐 Authentication

Firebase authentication is used for user management.

- Login: signInWithEmailAndPassword
- Signup: createUserWithEmailAndPassword
- Password reset supported
- Login events are logged using logUserEvent utilities

Routes handled in src/main.jsx:

- /
- /login
- /signup
- /forgot-password
- /reset-password

## 🧩 UI Component Details

- HeadersSection — Manages request headers with enable/disable support
- ParamsSection — Manages URL query parameters
- CollectionsSidebar — Displays saved collections
- HistorySidebar — Displays request history
- MobileTabs — Responsive navigation for small screens

## 🛠️ Troubleshooting

- Environment variables not loading:
  - Ensure all variables start with VITE_
  - Restart the dev server after changes
- Backend errors:
  - Check VITE_API_BASE_URL
  - Ensure backend server is running

## 👩‍💻 Author

Supritha RP  

## ⭐ Support

If you find this project useful:

- Star the repository
- Fork and enhance it
- Use it as a base for your own API testing tools

## 📸 Screenshots

Screenshots that capture the key features, usability, and responsive layout of the API Testing Tool in action.
<img width="1872" height="790" alt="image" src="https://github.com/user-attachments/assets/009e9837-330f-49e8-a1d8-6d7bb06fcbae" />
<img width="1676" height="753" alt="image" src="https://github.com/user-attachments/assets/65afeccc-c799-4940-8967-850d2d54aab7" />
<img width="1905" height="705" alt="image" src="https://github.com/user-attachments/assets/500122b8-4133-4b91-aa99-df76ed3b6a72" />
<img width="1909" height="700" alt="image" src="https://github.com/user-attachments/assets/7865d7d4-27a6-4334-88e0-13bfcb9b6cb8" />
<img width="1901" height="643" alt="image" src="https://github.com/user-attachments/assets/934dfbaf-6459-4052-99d6-278e758c075a" />



