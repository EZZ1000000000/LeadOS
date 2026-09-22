#!/usr/bin/env node
/* LeadOS — سكربت التنصيب على ويندوز (بيتنده من install.bat)
   بيعمل: فحص Node → npm install → prisma generate → build → تجهيز standalone
   بيتعامل مع أي مسار على الجهاز وبيشتغل من غير صلاحيات admin */
'use strict';
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, 'runtime');
const NODE_MIN_MAJOR = 20;
const NODE_PORTABLE_VERSION = 'v22.14.0';

const step = (n, t) => console.log(`\n=== [${n}] ${t} ===`);
const ok = (m) => console.log('✅ ' + m);
const warn = (m) => console.log('⚠️  ' + m);
const fail = (m) => { console.error('\n❌ ' + m + '\n'); process.exit(1); };

function nodeMajor() { return parseInt(process.versions.node.split('.')[0], 10); }

/* لو النود الحالي أقدم من المطلوب: نزّل نسخة محمولة وأعد تشغيل نفس السكربت بيها */
function ensureModernNode() {
  if (nodeMajor() >= NODE_MIN_MAJOR) return;
  const portable = path.join(RUNTIME, 'node.exe');
  if (fs.existsSync(portable)) {
    const r = spawnSync(portable, [__filename], { stdio: 'inherit' });
    process.exit(r.status || 0);
  }
  step(0, `الـNode الحالي (${process.versions.node}) أقدم من المطلوب — هحمّل Node ${NODE_PORTABLE_VERSION} محمولة (بدون admin)`);
  fs.mkdirSync(RUNTIME, { recursive: true });
  const url = `https://nodejs.org/dist/${NODE_PORTABLE_VERSION}/node-${NODE_PORTABLE_VERSION}-win-x64.zip`;
  try {
    execSync(`curl.exe -L --progress-bar -o node.zip "${url}"`, { cwd: ROOT, stdio: 'inherit' });
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force 'node.zip' '_noderoot'; ` +
      `Move-Item -Force '_noderoot\\node-${NODE_PORTABLE_VERSION}-win-x64\\*' 'runtime\\'; ` +
      `Remove-Item -Recurse -Force '_noderoot'; Remove-Item -Force 'node.zip'"`,
      { cwd: ROOT, stdio: 'inherit' }
    );
  } catch (e) {
    fail('تحميل Node فشل — اتأكد من الإنترنت. أو نزّل Node LTS يدوياً من nodejs.org وثبتّه وأعد install.bat');
  }
  ok('Node المحمولة جاهزة في مجلد runtime/');
  const r = spawnSync(portable, [__filename], { stdio: 'inherit' });
  process.exit(r.status || 0);
}

function run(cmd, opts) {
  console.log('   > ' + cmd);
  execSync(cmd, Object.assign({ cwd: ROOT, stdio: 'inherit' }, opts || {}));
}

/* npm 12+ بيقفل سكربتات ما-after-التنصيب افتراضياً — بنشغل المهم منها يدوياً */
function fixBlockedPostinstalls() {
  const critical = [
    '@prisma/engines/scripts/postinstall.js',  // بينزّل محركات Prisma (ضروري!)
    '@prisma/client/scripts/postinstall.js',   // بيربط الكلينت
    'sharp/install/check.js',                  // بيتأكد من باينري sharp
  ];
  for (const rel of critical) {
    const f = path.join(ROOT, 'node_modules', rel);
    if (!fs.existsSync(f)) { console.log('   (مش موجود، تخطي: ' + rel + ')'); continue; }
    console.log('   > node ' + rel);
    try { execSync(`node "${f}"`, { cwd: ROOT, stdio: 'pipe' }); }
    catch (_) { console.log('   (تحذير متجاهل: ' + rel + ')'); }
  }
}

/* نتأكد إن محرك قاعدة البيانات موجود فعلاً — لو مش موجود بنصلحه مرة تانية */
function findQueryEngine() {
  const dirs = [
    path.join(ROOT, 'node_modules', '.prisma', 'client'),
    path.join(ROOT, 'node_modules', '@prisma', 'client'),
    path.join(ROOT, 'node_modules', '@prisma', 'engines'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.node') && /engine/i.test(f)) return path.join(dir, f);
      }
    } catch (_) {}
  }
  return null;
}

function ensureQueryEngine() {
  let engine = findQueryEngine();
  if (engine) { ok('محرك قاعدة البيانات موجود ✅ (' + path.basename(engine) + ')'); return; }
  warn('محرك Prisma مش ظاهر — جاري إصلاحه...');
  try { execSync(`node "${path.join(ROOT, 'node_modules', '@prisma', 'engines', 'scripts', 'postinstall.js')}"`, { cwd: ROOT, stdio: 'pipe' }); } catch (_) {}
  try { run('npx prisma generate'); } catch (_) {}
  engine = findQueryEngine();
  if (!engine) fail('محرك قاعدة البيانات ناقص — امسح مجلد node_modules وشغّل install.bat تاني');
  ok('محرك قاعدة البيانات اتحط بعد الإصلاح: ' + path.basename(engine));
}

function loadEnvFile() {
  const env = {};
  const f = path.join(ROOT, '.env.local');
  if (!fs.existsSync(f)) fail('ملف .env.local مش موجود في مجلد المشروع — الحزمة ناقصة!');
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k) env[k] = v;
  }
  return env;
}

function main() {
  const isWin = process.platform === 'win32';
  ensureModernNode();

  console.log('\n==================================================');
  console.log('  LeadOS — التنصيب (' + (isWin ? 'Windows' : process.platform) + ')');
  console.log('  Node: ' + process.version);
  console.log('  المجلد: ' + ROOT);
  console.log('==================================================');

  if (/\s/.test(ROOT)) {
    warn('مسار المشروع فيه مسافات — شغّالة غالباً، بس الأفضل فك الضغط في مسار من غير مسافات (مثال: C:\\LeadOS)');
  }

  /* 1) فحوصات أساسية */
  step(1, 'فحص ملفات المشروع');
  if (!fs.existsSync(path.join(ROOT, 'prisma', 'schema.prisma'))) fail('prisma/schema.prisma مش موجود — الحزمة ناقصة، نزّلها تاني');
  const dbPath = path.join(ROOT, 'db', 'custom.db');
  const hasDb = fs.existsSync(dbPath);
  if (hasDb) ok('قاعدة البيانات موجودة (db/custom.db) — كل بياناتك هترجع زي ما هي');
  else warn('db/custom.db مش موجودة — هتتعمل فاضية في الخطوة الجاية');

  /* 2) المكتبات */
  step(2, 'تحميل المكتبات (npm install) — أول مرة ممكن ياخد 3-15 دقيقة حسب النت');
  run('npm install --no-audit --no-fund');
  ok('المكتبات اتثبتت');
  step('2+', 'إصلاح سكربتات الحزم اللي npm 12 بيمنعها (Prisma + sharp)');
  fixBlockedPostinstalls();
  ok('الإصلاح خلص');

  /* 3) Prisma */
  step(3, 'تجهيز قاعدة البيانات (Prisma)');
  const env = loadEnvFile();
  const dbUrl = 'file:' + dbPath.split(path.sep).join('/');
  run('npx prisma generate');
  ensureQueryEngine();
  if (!hasDb) {
    console.log('   القاعدة مش موجودة — هتتعمل من السكيما (فاضية)...');
    run('npx prisma db push', { env: Object.assign({}, process.env, env, { DATABASE_URL: dbUrl }) });
    warn('القاعدة اتعملت فاضية — هتحتاج تسجل دخول بحساب جديد أو ترجّع نسخة قاعدة قديمة في db/custom.db');
  } else {
    ok('القاعدة موجودة — من غير أي تعديل عليها');
  }

  /* 4) البناء */
  step(4, 'بناء المشروع (next build) — أطول خطوة، ممكن 3-6 دقايق');
  const buildEnv = Object.assign({}, process.env, env, {
    NODE_ENV: 'production',
    DATABASE_URL: dbUrl,
    NEXT_TELEMETRY_DISABLED: '1',
  });
  run('npm run build', { env: buildEnv });
  ok('البناء خلص');

  /* 5) التحقق النهائي */
  step(5, 'التحقق النهائي');
  if (!fs.existsSync(path.join(ROOT, '.next', 'standalone', 'server.js'))) {
    fail('البناء مطلعش ملف التشغيل standalone — جرّب تشغّل install.bat تاني');
  }
  ok('ملفات التشغيل جاهزة (.next/standalone)');

  console.log('\n==================================================');
  console.log('   🎉 التنصيب خلص بنجاح!');
  console.log('');
  console.log('   الخطوة الجاية:  دبل كليك على  start.bat');
  console.log('   وبعدين افتح المتصفح:  http://localhost:3000');
  console.log('');
  console.log('   نصيحة: شغّل install-autorun.bat مرة واحدة عشان');
  console.log('   LeadOS يشتغل لوحده مع بداية الويندوز');
  console.log('==================================================\n');
}

main();
