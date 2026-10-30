# Small Wonders

> **“A place for the things you almost missed.”**

Small Wonders is a private digital field journal for people who enjoy noticing the quiet, fleeting details of everyday life: the geometry of afternoon light on a kitchen wall, a tiny fern growing between paving stones, the mechanical sigh of a station clock before the hour, or a worn architectural lintel.

Built with **React 18**, **TypeScript**, **Vite**, **Three.js / React Three Fiber**, **Firebase Authentication**, **Cloud Firestore**, **Vercel Serverless Functions**, **Firebase Admin SDK**, **Upstash Redis**, and **Zod-compatible strict runtime schemas**.

---

## 1. Architecture & Non-Negotiable Security Boundary

Small Wonders enforces a strict **Client-Read / Serverless-Write** security boundary:

- **Direct Authorized Reads (`Client → Cloud Firestore`)**:
  The browser client reads only documents under `users/{uid}` and `users/{uid}/entries/{entryId}` that belong to the currently authenticated user. Client-side code never calls `addDoc`, `setDoc`, `updateDoc`, or `deleteDoc`.
- **Deployed Firestore Security Rules (`firestore.rules`)**:
  All client-side writes (`create`, `update`, `delete`) are unconditionally denied (`allow create, update, delete: if false;`). List queries are bounded (`request.query.limit <= 50`), cross-user reads are denied, and all unrecognized paths default-deny.
- **Serverless Write API (`Client → Vercel Functions → Firebase Admin SDK → Firestore`)**:
  Every mutation passes through hardened Vercel Serverless Functions:
  - `POST /api/entries` (`api/entries/index.ts`) - Create a journal observation.
  - `PATCH /api/entries/:entryId` (`api/entries/[entryId].ts`) - Update an existing observation in the caller's namespace.
  - `DELETE /api/entries/:entryId` (`api/entries/[entryId].ts`) - Delete an existing observation in the caller's namespace.
  - `DELETE /api/account` (`api/account.ts`) - Abuse-resistant account deletion workflow that deletes `users/{uid}/entries` in bounded batches of 100, removes `users/{uid}`, and deletes the Firebase Authentication account.

### Defense-in-Depth Controls on Every Write Endpoint

1. **HTTP Method Allowlist**: Rejects unsupported methods with `405 Method Not Allowed` and an explicit `Allow` header.
2. **Origin & CORS Policy**: Validates the `Origin` header against `ALLOWED_ORIGINS`; never uses wildcard `*` on authenticated mutation endpoints.
3. **Payload Size & Content-Type Enforcement**: Requires `application/json` (`415`) and caps request payloads at `16 KB` (`413`) before expensive work.
4. **Firebase ID Token & Email Verification**: Extracts `Authorization: Bearer <token>`, verifies it via Firebase Admin `verifyIdToken(token, true)` (`401`), derives `uid` exclusively from the verified token, and requires verified email ownership (`403 EMAIL_NOT_VERIFIED`).
5. **Firebase App Check Verification**: Validates `X-Firebase-AppCheck` header via `admin.appCheck().verifyToken()` when `ENFORCE_APP_CHECK="true"`.
6. **Persistent Rate Limiting (Upstash Redis)**: Enforces per-UID and per-IP sliding window limits (`create: 12/min`, `update: 20/min`, `delete: 20/min`, `account_delete: 3/hour`, `ip_mutation: 30/min`). Fails closed (`503 Service Unavailable`) if production Redis credentials are unconfigured.
7. **Strict Runtime Validation (`src/schemas/entry.ts`)**: Enforces title (`1-80` chars), note (`1-500` chars), category enum (`Nature`, `Light`, `Architecture`, `People`, `Sound`, `Unexpected`), normalized tags (`max 5`, `1-24` chars each), valid `observedAt` range (`1970` to `+24h`), optional `placeLabel` (`max 80` chars), and `.strict()` object validation that rejects any client-supplied `uid`, `createdAt`, `updatedAt`, or unknown fields.

---

## 2. Design Direction & Applied Skills

- **Brief Inference (Design Read)**:
  *"Reading this as: Editorial consumer field-journal web application and landing experience for observant readers and writers, with a quiet tactile botanical-print language, leaning toward bespoke CSS tokens + Instrument Serif & DM Sans + restrained scroll choreography and sculptural 3D paper topography."*
- **Configured Dials**:
  - `DESIGN_VARIANCE: 7` (Asymmetric split hero, varied editorial section compositions, strict single-column collapse below `768px`)
  - `MOTION_INTENSITY: 6` (Fluid CSS and scroll-linked reveals, interactive 3D afternoon sun-angle control, full `prefers-reduced-motion` compliance)
  - `VISUAL_DENSITY: 3` (Independent print publication breathing room, generous negative space, thin `#DEDCD2` editorial rules)
- **Color Palette**:
  - Warm Paper Light Mode: Warm Ivory (`#F6F3EA`), Paper White (`#FCFBF7`), Deep Forest Ink (`#193B32`), Charcoal (`#252923`), Muted Olive (`#7F8966`), Burnished Amber (`#C58B55`), Quiet Border (`#DEDCD2`), Muted Text (`#5C5F57`).
  - Nocturnal Dark Mode: Deep Forest Night (`#111815`), Elevated Slate-Moss (`#16201C`), Warm Parchment (`#EDE9DF`), Burnished Amber (`#D49A64`).

---

## 3. Step-by-Step Setup & Deployment Guide (14 Steps)

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/) and create a new project (e.g., `small-wonders-prod`).
2. Register a new **Web App** inside the project settings and copy the client configuration values (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

### Step 2: Enable Authentication Providers
1. In Firebase Console → **Authentication** → **Sign-in method**, enable:
   - **Email/Password** (leave passwordless email link disabled unless needed).
   - **Google** (configure your support email and save).

### Step 3: Configure Authorized Domains
1. In **Authentication** → **Settings** → **Authorized domains**, verify `localhost` is present and add your production Vercel domain (e.g., `small-wonders.vercel.app` or your custom domain).

### Step 4: Configure Email Verification and Password-Reset Emails
1. In **Authentication** → **Templates**, customize the **Email address verification** and **Password reset** templates with your sender name (`Small Wonders`) and action URL.

### Step 5: Initialize Cloud Firestore
1. In Firebase Console → **Firestore Database**, create a database in **Production mode** in the region closest to your users.

### Step 6: Deploy Firestore Security Rules
```bash
npx firebase-tools deploy --only firestore:rules
```

### Step 7: Deploy Firestore Composite Indexes
```bash
npx firebase-tools deploy --only firestore:indexes
```

### Step 8: Configure Firebase App Check (Recommended for Production)
1. In Firebase Console → **App Check**, register your web app with **reCAPTCHA Enterprise** and copy the site key into `VITE_FIREBASE_APPCHECK_SITE_KEY`.
2. Set `VITE_ENABLE_APP_CHECK="true"` and `ENFORCE_APP_CHECK="true"`.

### Step 9: Set Up Persistent Rate Limiting (Upstash Redis)
1. Create a Redis database in [Upstash Console](https://console.upstash.com/).
2. Copy the REST URL and REST Token into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### Step 10: Configure Firebase Admin Credentials
1. In Firebase Console → **Project Settings** → **Service accounts**, click **Generate new private key**.
2. Store the JSON string in the server-only `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` variable (or set `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY`). Never prefix these with `VITE_`.

### Step 11: Add Vercel Environment Variables
1. Copy all required variables from `.env.example` into your Vercel Project Settings → **Environment Variables**.
2. Ensure `ALLOWED_ORIGINS` lists your exact production origin (e.g., `https://small-wonders.vercel.app`).

### Step 12: Run the Application Locally
```bash
cp .env.example .env.local
npm install
npm run dev
```
*(Note: If `.env.local` retains placeholder values, the client automatically runs in **Local Sandbox Mode** so you can explore the UI, 3D hero, and full journal workflow immediately prior to connecting cloud credentials.)*

### Step 13: Run Firebase Emulators and Tests
```bash
# Run TypeScript verification, Unit tests, Firestore Rules tests, and API Security tests
npm run typecheck
npm test

# Run End-to-End Headless Browser Tests
npm run test:e2e
```

### Step 14: Deploy to Vercel
```bash
npx vercel --prod
```

---

## 4. Known Limitations & Owner Review Notes

- **Legal Templates**: The `/terms`, `/privacy`, `/cookies`, and `/accessibility` routes accurately describe the implemented application architecture, storage mechanisms, and third-party providers (Firebase, Vercel, Upstash), but must be reviewed by the project owner and legal counsel for jurisdiction-specific requirements before commercial use. Configure `VITE_PUBLIC_CONTACT_EMAIL` and operator details in `.env`.
- **Provider Reauthentication on Account Deletion**: `DELETE /api/account` deletes all Firestore entries and the Firebase Auth user on the server using the Firebase Admin SDK, which does not require client-side reauthentication if the user holds a valid, non-revoked ID token.
- **Search Scope**: To prevent downloading unbounded collections on the client, keyword search filters the currently loaded archive pages while category filtering and date sorting execute via indexed Firestore cursor pagination.
