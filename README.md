# Small Wonders

> A private, distraction-free digital field journal for recording the quiet, fleeting details of everyday life.

[License: MIT](https://www.google.com/search?q=LICENSE)
[](https://www.typescriptlang.org/)
[](https://react.dev/)
[](https://vitejs.dev/)
[](https://threejs.org/)
[](https://firebase.google.com/)
[](https://vercel.com/)

---

## Overview

Most modern software is engineered to broadcast, quantify, or accelerate. **Small Wonders** is built for the opposite impulse: pausing for thirty seconds to notice something small before it fades from memory. 

Whether it is a narrow band of afternoon sunlight clearing a kitchen windowsill, a wild fern taking root in a pavement fissure, the metallic sigh of an old station clock before the hour, or an acanthus leaf worn smooth on a limestone doorway, Small Wonders provides an archival digital ledger to preserve those moments.

Designed with an intentional editorial philosophy:
- **No algorithmic feeds, follower counts, or social streaks**: Your notebook is private by default.
- **Architectural & cartographic specimen identity**: Designed like a physical botanical ledger, using warm carbon-peat and cotton-rag paper tones, tabular numerals, and border-only surface elevation.
- **Non-negotiable security boundary**: Read-only client Firestore security rules paired with hardened, rate-limited serverless functions.
- **Zero-config sandbox mode**: Runs immediately in the browser with full offline mock storage, transitioning seamlessly to live Firebase and Upstash infrastructure when credentials are provided.

---

## Key Features

### 1. Asymmetric Field Specimen Ledger
- Record observations in under thirty seconds with an 80-character title, 500-character field note, and optional manual place label.
- Categorize records across 6 curated observation lenses: `Light`, `Nature`, `Architecture`, `People`, `Sound`, and `Unexpected`.
- Tag entries with up to 5 lowercase normalized tags (`#solstice`, `#botany`, `#masonry`).
- Zero background GPS tracking: Place descriptions are purely manual text strings.

### 2. Interactive 3D Topographic Observatory
- Procedurally generated sculpted terrain relief featuring shaded elevation quads and glowing iso-contour terraces.
- Dual intersecting astrolabe meridian gimbals and an orbiting solar azimuth node.
- Live ember sun-angle slider (`120°` to `260°`) that dynamically recalculates scene shadows and lighting temperatures.
- 3 interactive 3D specimen sculptures:
  - **Specimen 01 (Light)**: Solstice prism core with crystalline cage and equatorial halo.
  - **Specimen 02 (Nature)**: Unfurling 6-tier botanical phyllotaxis spire.
  - **Specimen 03 (Sound)**: Concentric acoustic wavefield with harmonic resonator core.
- Dynamic dual-mode rendering: WebGL/Three.js with graceful fallback to a high-precision `<canvas>` 3D perspective projection engine.

### 3. Floating Island Pill Header
- Starts full-width, borderless, and transparent at the top of the viewport.
- Smoothly animates into a centered floating island pill (`backdrop-filter: blur(16px)`, `border-radius: 9999px`) on scroll, with smooth reverse animation when returning to the top.

### 4. Archival Dual-Theme System
- **Carbon Mode**: Warm carbon-peat (`#0C0B0A`), matte charcoal (`#151311`), and terracotta-vermilion (`#E04F26`) survey accents.
- **Paper Mode**: Warm cotton-rag paper (`#F7F4EE`), crisp white surfaces (`#FFFFFF`), graphite ink (`#181614`), and archival vermilion (`#C83E14`).
- Border-only surface elevation: Eliminates fake shadow doubling, reserving elevation shadows strictly for floating dialogs and toasts.

### 5. Client-Read / Serverless-Write Security Architecture
- **Direct Client Reads**: The browser client reads strictly from `users/{uid}` and `users/{uid}/entries/{entryId}`. Client code contains zero Firestore write calls.
- **Strict Firestore Rules**: All client-side `create`, `update`, and `delete` operations are unconditionally blocked (`allow create, update, delete: if false;`). Unbounded queries (`> 50`) and cross-user paths are rejected.
- **Verified Serverless Mutations**: All database writes pass through Vercel Serverless Functions powered by the Firebase Admin SDK.
- **Sliding-Window Rate Limiting**: Upstash Redis sliding-window counters protect against automated spam and brute force (fails closed in production if rate-limit infrastructure is unreachable).
- **Strict Payload Validation**: Zod-compatible runtime schema enforcement rejects unknown properties, client-supplied timestamps, and ownership spoofing.

### 6. Full Data Ownership & Privacy
- One-click JSON journal export from the Settings view.
- Complete, atomic account deletion workflow (`DELETE /api/account`) that batches deletion of all stored Firestore records and removes the Firebase Authentication profile.

---

## Architecture & Security Model

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   Browser Client                       │
                    └───────────┬────────────────────────────────┬───────────┘
                                │                                │
                      Read-Only │ Direct Reads       Mutations   │ POST / PATCH / DELETE
                   (Scoped UID) │ (Client SDK)       (Bearer ID) │ (JSON Payloads)
                                ▼                                ▼
                    ┌──────────────────────┐         ┌───────────────────────┐
                    │   Cloud Firestore    │         │   Vercel Serverless   │
                    │   (firestore.rules)  │         │   Functions (/api)    │
                    │                      │         └───────────┬───────────┘
                    │ allow create, update,│                     │ 1. Origin / Method Allowlist
                    │ delete: if false;    │                     │ 2. Payload Cap (16 KB)
                    │ allow read: if auth  │                     │ 3. verifyIdToken(token, true)
                    │ && uid == auth.uid;  │                     │ 4. Upstash Rate Limiting
                    └───────────▲──────────┘                     │ 5. Strict Schema Validation
                                │                                │
                                └────────────────────────────────┘
                                    Firebase Admin SDK Mutations
```

### Serverless API Endpoints

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `POST` | `/api/entries` | Create a new observation record | 12 req / min |
| `PATCH` | `/api/entries/:entryId` | Update an existing observation owned by caller | 20 req / min |
| `DELETE` | `/api/entries/:entryId` | Delete an observation owned by caller | 20 req / min |
| `DELETE` | `/api/account` | Batched atomic removal of all entries and user account | 3 req / hour |

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Three.js, React Three Fiber.
- **Design System**: Vanilla CSS custom properties, fluid typographic scale (`clamp()`), concentric radii tokens, `@media (hover: hover)` interaction gating.
- **Backend**: Vercel Serverless Functions, Node.js, Firebase Admin SDK.
- **Database & Identity**: Google Cloud Firestore, Firebase Authentication, Firebase App Check (reCAPTCHA Enterprise).
- **Rate Limiting**: Upstash Redis (`@upstash/ratelimit`).
- **Testing & QA**: Playwright, Selenium WebDriver (Headless Chromium), Node.js native test runner, Babel AST typechecking.

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/small-wonders.git
cd small-wonders

# Install dependencies
npm install

# Start local development server (runs with local sandbox storage out of the box)
npm run dev
```

Visit `http://localhost:5173` to explore the landing page, 3D observatory, and notebook dashboard.

---

## Deployment & Production Configuration

To deploy Small Wonders to production with live Firebase and Upstash infrastructure:

### 1. Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

#### Client Variables (Vite)
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_ENABLE_APP_CHECK=false
VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_site_key
```

#### Server Variables (Vercel Serverless Functions)
```env
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
ALLOWED_ORIGINS=https://small-wonders.vercel.app
ENFORCE_APP_CHECK=false
```

### 2. Deploy Firestore Rules and Indexes

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

### 3. Deploy to Vercel

```bash
npx vercel deploy --prod
```

---

## Verification & Test Suite

The project includes an end-to-end and security test suite covering browser DOM audits, headless viewport responsiveness, and API authorization:

```bash
# Run TypeScript compilation check across all 37 files
npm run typecheck

# Run unit tests, schema validators, and API security checks
npm run test:unit

# Run full Headless Chromium E2E verification (Desktop 1440x900 & Mobile 390x844)
npm run test:e2e

# Run complete production build verification
npm run build
```

---

## Project Structure

```
small-wonders/
├── api/                        # Vercel serverless function handlers
│   ├── _lib/                   # Shared auth, rate limiting, and validation helpers
│   ├── entries/                # Observation creation, update, and deletion endpoints
│   └── account.ts              # Account deletion handler
├── firestore.rules             # Production Cloud Firestore security rules
├── firestore.indexes.json      # Firestore composite index definitions
├── public/                     # Static images and brand assets
├── src/
│   ├── app/                    # Root application component and routing
│   ├── components/
│   │   ├── layout/             # Header island, PublicLayout, and AppShell
│   │   ├── three/              # 3D Topographic Observatory scene and fallbacks
│   │   └── ui/                 # Primitives (Button, SpotlightCard, InputField)
│   ├── features/
│   │   ├── auth/               # Firebase Authentication context and hooks
│   │   └── journal/            # Firestore client-read context and cache
│   ├── pages/
│   │   ├── app/                # Authenticated views (Dashboard, Archive, Editor, Settings)
│   │   ├── auth/               # Sign-in, sign-up, and password recovery
│   │   └── public/             # Landing page and Read-mode legal documents
│   ├── schemas/                # Strict Zod runtime validation schemas
│   └── styles/
│       └── theme.css           # Direction Contract tokens and component styles
├── tests/
│   ├── unit/                   # Unit schemas and read rule tests
│   ├── integration/            # Firestore security and API rate limit tests
│   └── e2e/                    # Headless Chromium automated workflow tests
└── vercel.json                 # Vercel serverless build and routing configuration
```

---

## License

Distributed under the MIT License. See [LICENSE](https://www.google.com/search?q=LICENSE) for details.
