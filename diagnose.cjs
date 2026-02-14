#!/usr/bin/env node

/**
 * Flow 6 Diagnostic Script
 * Run this to check your setup before testing Flow 6
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Flow 6 Diagnostic Check\n');

// Check 1: .env file exists
console.log('1. Checking .env file...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');

  const hasSupabaseUrl = envContent.includes('VITE_SUPABASE_URL=');
  const hasSupabaseKey = envContent.includes('VITE_SUPABASE_ANON_KEY=');
  const hasFirebaseKey = envContent.includes('VITE_FIREBASE_API_KEY=');
  const hasFirebaseDomain = envContent.includes('VITE_FIREBASE_AUTH_DOMAIN=');
  const hasFirebaseProject = envContent.includes('VITE_FIREBASE_PROJECT_ID=');

  console.log(`   ✅ .env file exists`);
  console.log(`   ${hasSupabaseUrl ? '✅' : '❌'} VITE_SUPABASE_URL`);
  console.log(`   ${hasSupabaseKey ? '✅' : '❌'} VITE_SUPABASE_ANON_KEY`);
  console.log(`   ${hasFirebaseKey ? '✅' : '❌'} VITE_FIREBASE_API_KEY`);
  console.log(`   ${hasFirebaseDomain ? '✅' : '❌'} VITE_FIREBASE_AUTH_DOMAIN`);
  console.log(`   ${hasFirebaseProject ? '✅' : '❌'} VITE_FIREBASE_PROJECT_ID`);

  if (!hasFirebaseKey || !hasFirebaseDomain || !hasFirebaseProject) {
    console.log('\n   ⚠️  Missing Firebase config! See FLOW_6_SETUP.md Step 4');
  }
} else {
  console.log('   ❌ .env file not found!');
  console.log('   👉 Copy .env.example to .env and fill in values');
}

// Check 2: Edge Function exists
console.log('\n2. Checking Edge Function...');
const edgeFunctionPath = path.join(__dirname, 'supabase/functions/get-firebase-token/index.ts');
if (fs.existsSync(edgeFunctionPath)) {
  console.log('   ✅ get-firebase-token/index.ts exists');
  console.log('   👉 Still need to deploy it via Supabase Dashboard or CLI');
} else {
  console.log('   ❌ Edge Function file missing!');
}

// Check 3: Firebase config files
console.log('\n3. Checking Firebase config...');
const firebaseRules = path.join(__dirname, 'firebase/firestore.rules');
const firebaseIndexes = path.join(__dirname, 'firebase/firestore.indexes.json');
if (fs.existsSync(firebaseRules)) {
  console.log('   ✅ firestore.rules exists');
} else {
  console.log('   ❌ firestore.rules missing!');
}
if (fs.existsSync(firebaseIndexes)) {
  console.log('   ✅ firestore.indexes.json exists');
} else {
  console.log('   ❌ firestore.indexes.json missing!');
}

// Check 4: Flow 6 components
console.log('\n4. Checking Flow 6 components...');
const components = [
  'src/lib/firebase.ts',
  'src/lib/services/tasks.ts',
  'src/app/components/TaskCard.tsx',
  'src/app/components/SwipeableTaskCard.tsx',
  'src/app/components/AddTaskFAB.tsx',
  'src/app/components/NetworkStatusBanner.tsx',
];

components.forEach(comp => {
  const exists = fs.existsSync(path.join(__dirname, comp));
  console.log(`   ${exists ? '✅' : '❌'} ${comp}`);
});

// Check 5: Dependencies
console.log('\n5. Checking package.json dependencies...');
const packageJson = require('./package.json');
const deps = packageJson.dependencies || {};

const requiredDeps = {
  'firebase': deps.firebase,
  'react-swipeable': deps['react-swipeable'],
  'date-fns': deps['date-fns'],
};

Object.entries(requiredDeps).forEach(([dep, version]) => {
  if (version) {
    console.log(`   ✅ ${dep} (${version})`);
  } else {
    console.log(`   ❌ ${dep} missing!`);
    console.log(`      Run: npm install ${dep}`);
  }
});

// Check 6: node_modules
console.log('\n6. Checking node_modules...');
if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('   ✅ node_modules exists');
} else {
  console.log('   ❌ node_modules missing!');
  console.log('   👉 Run: npm install');
}

// Summary
console.log('\n📋 Summary:');
console.log('');
console.log('If all checks pass (✅), you should be able to test Flow 6.');
console.log('');
console.log('Next steps:');
console.log('  1. Start dev server: npm run dev');
console.log('  2. Open http://localhost:5173');
console.log('  3. Sign in with Google');
console.log('  4. Check browser console for "Firebase auth:" logs');
console.log('');
console.log('If you see errors, check TROUBLESHOOTING.md for solutions.');
console.log('');
