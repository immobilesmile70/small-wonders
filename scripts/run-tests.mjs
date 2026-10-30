import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire('/usr/share/nodejs/');
const babel = require('@babel/core');

const rootDir = process.cwd();
const tmpDir = path.join('/tmp', 'small-wonders-test-cjs');

const FILES_TO_COMPILE = [
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
];

function compileAllFiles() {
  for (const relPath of FILES_TO_COMPILE) {
    const fullPath = path.join(rootDir, relPath);
    const rawCode = fs.readFileSync(fullPath, 'utf8').replace(
      /\bimport\.meta\b/g,
      '({ env: process.env })'
    );
    const transformed = babel.transformSync(rawCode, {
      filename: fullPath,
      presets: [
        [require.resolve('@babel/preset-env'), { targets: { node: 'current' }, modules: 'commonjs' }],
        [require.resolve('@babel/preset-typescript'), { allowDeclareFields: true }],
        [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
      ],
      sourceMaps: 'inline',
    });
    const outPath = path.join(tmpDir, relPath.replace(/\.tsx?$/, '.cjs'));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const patchedCode = transformed.code.replace(
      /require\((['"])(\.[^'"]+)\1\)/g,
      (match, quote, spec) => {
        if (spec.endsWith('.css')) return '{}';
        if (spec.endsWith('.cjs') || spec.endsWith('.json')) return match;
        return `require(${quote}${spec}.cjs${quote})`;
      }
    );
    fs.writeFileSync(outPath, patchedCode, 'utf8');
  }
}

function writeExternalTestStubs() {
  const nmDir = path.join(tmpDir, 'node_modules');
  const stubs = {
    'firebase/app': `
      module.exports = {
        initializeApp: () => ({}),
        getApps: () => [],
      };
    `,
    'firebase/auth': `
      module.exports = {
        getAuth: () => ({}),
        connectAuthEmulator: () => {},
        createUserWithEmailAndPassword: async () => ({}),
        signInWithEmailAndPassword: async () => ({}),
        signInWithPopup: async () => ({}),
        GoogleAuthProvider: class { setCustomParameters() {} },
        sendEmailVerification: async () => {},
        sendPasswordResetEmail: async () => {},
        signOut: async () => {},
        updateProfile: async () => {},
        onAuthStateChanged: () => () => {},
      };
    `,
    'firebase/firestore': `
      module.exports = {
        getFirestore: () => ({}),
        connectFirestoreEmulator: () => {},
        collection: () => ({}),
        doc: () => ({}),
        getDoc: async () => ({ exists: () => false }),
        getDocs: async () => ({ docs: [] }),
        query: () => ({}),
        where: () => ({}),
        orderBy: () => ({}),
        limit: () => ({}),
        startAfter: () => ({}),
      };
    `,
    'firebase/app-check': `
      module.exports = {
        initializeAppCheck: () => ({}),
        ReCaptchaEnterpriseProvider: class {},
        getToken: async () => ({ token: 'stub' }),
      };
    `,
    'react': `
      module.exports = {
        createContext: (def) => ({ Provider: () => null, _default: def }),
        useContext: () => ({}),
        useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
        useEffect: () => {},
        useMemo: (fn) => fn(),
        useCallback: (fn) => fn,
        useId: () => 'id-1',
        useRef: (v) => ({ current: v }),
        lazy: (fn) => fn,
        Suspense: () => null,
        StrictMode: () => null,
      };
    `,
    'react/jsx-runtime': `
      module.exports = {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
        Fragment: 'Fragment',
      };
    `,
  };

  for (const [pkg, content] of Object.entries(stubs)) {
    const pkgDir = path.join(nmDir, pkg);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'index.js'), content, 'utf8');
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: pkg, main: 'index.js' }),
      'utf8'
    );
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });
writeExternalTestStubs();
compileAllFiles();

const suiteArg = process.argv[2] || 'all';
const testFiles = [];
if (suiteArg === 'all' || suiteArg === 'unit') {
  testFiles.push(path.join(tmpDir, 'tests/unit/schemas-and-reads.test.cjs'));
}
if (suiteArg === 'all' || suiteArg === 'rules') {
  testFiles.push(path.join(tmpDir, 'tests/integration/firestore-rules.test.cjs'));
}
if (suiteArg === 'all' || suiteArg === 'security') {
  testFiles.push(path.join(tmpDir, 'tests/integration/api-security.test.cjs'));
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  cwd: rootDir,
  env: {
    ...process.env,
    NODE_PATH: path.join(tmpDir, 'node_modules'),
  },
});

process.exit(result.status ?? 1);
