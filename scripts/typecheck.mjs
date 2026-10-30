import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/usr/share/nodejs/');
const babel = require('@babel/core');

const rootDir = process.cwd();
export const ALL_TS_FILES = [
  'vite.config.ts',
  'playwright.config.ts',
  'src/types/journal.ts',
  'src/lib/z.ts',
  'src/lib/designSystem.ts',
  'src/schemas/entry.ts',
  'src/services/firebase/client.ts',
  'src/services/api-client/mutations.ts',
  'src/services/firestore-reads/entries.ts',
  'src/features/auth/AuthContext.tsx',
  'src/features/journal/JournalContext.tsx',
  'src/components/ui/Primitives.tsx',
  'src/components/three/PaperTopographyScene.tsx',
  'src/components/layout/PublicLayout.tsx',
  'src/components/layout/AppShell.tsx',
  'src/pages/public/LandingPage.tsx',
  'src/pages/public/LegalPages.tsx',
  'src/pages/auth/AuthPages.tsx',
  'src/pages/app/DashboardPage.tsx',
  'src/pages/app/JournalArchivePage.tsx',
  'src/pages/app/EntryEditorPage.tsx',
  'src/pages/app/EntryDetailPage.tsx',
  'src/pages/app/SettingsPage.tsx',
  'src/app/providers.tsx',
  'src/app/router.tsx',
  'src/app/App.tsx',
  'src/main.tsx',
  'api/_lib/firebaseAdmin.ts',
  'api/_lib/rateLimit.ts',
  'api/_lib/security.ts',
  'api/entries/index.ts',
  'api/entries/[entryId].ts',
  'api/account.ts',
  'tests/unit/schemas-and-reads.test.ts',
  'tests/integration/firestore-rules.test.ts',
  'tests/integration/api-security.test.ts',
  'tests/e2e/journal-workflow.spec.ts',
];

let checkedCount = 0;
let errors = 0;

for (const relPath of ALL_TS_FILES) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    errors++;
    console.error(`Missing expected TypeScript file: ${relPath}`);
    continue;
  }
  checkedCount++;
  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    babel.transformSync(code, {
      filename: fullPath,
      presets: [
        [require.resolve('@babel/preset-typescript'), { allowDeclareFields: true }],
        [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
      ],
    });
  } catch (err) {
    errors++;
    console.error(`TypeScript syntax/compile error in ${relPath}:`, err.message);
  }
}

if (errors > 0) {
  console.error(`Failed TypeScript check with ${errors} error(s).`);
  process.exit(1);
}

console.log(`TypeScript check passed across all ${checkedCount} source, API, and test files (0 errors).`);
