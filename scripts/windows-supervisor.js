#!/usr/bin/env node
/* LeadOS — المشرف الدائم على ويندوز (بيتنده من start.bat)
   المسؤوليات:
   1) تشغيل خادم Next.js الـstandalone + إعادة تشغيله تلقائياً لو وقع
   2) النبضة الدورية: /api/cron/tick كل 11 دقيقة (معالجة مهام + صيد + زيزو)
   3) باك أب تلقائي للقاعدة كل 30 دقيقة في backups/ (آخر 24 نسخة)
   4) كل الإعدادات بتتقرا من .env.local + DATABASE_URL بيتحسب من مكان المجلد نفسه */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const BACKUP_DIR = path.join(ROOT, 'backups');
const DB_PATH = path.join(ROOT, 'db', 'custom.db');
const ENV_FILE = path.join(ROOT, '.env.local');
const STANDALONE = path.join(ROOT, '.next', 'standalone');

const TICK_INTERVAL_MS = 11 * 60 * 1000;   // 660 ثانية — زي نسخة اللينكس
const TICK_TIMEOUT_MS = 590 * 1000;        // صبر أطول من أطول دورة معالجة
const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 دقيقة
const RESTART_COOLDOWN_MS = 10 * 1000;
const KEEP_BACKUPS = 24;

function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function clog(msg) { try { process.stdout.write(`[${now()}] ${msg}\n`); } catch (_) {} }

function loadEnvFile() {
  const env = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 1) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k) env[k] = v;
    }
  } catch (_) { /* preflight هيمسك النقص */ }
  return env;
}

const fileEnv = loadEnvFile();
const PORT = parseInt(process.env.PORT || fileEnv.PORT || '3000', 10) || 3000;
const TICK_SECRET = fileEnv.CRON_SECRET || process.env.CRON_SECRET || '';

function rotateLog(file) {
  try {
    const st = fs.statSync(file);
    if (st.size > 10 * 1024 * 1024) {
      const old = file.replace(/\.log$/, '.old.log');
      try { fs.unlinkSync(old); } catch (_) {}
      fs.renameSync(file, old);
    }
  } catch (_) {}
}
function logStream(name) {
  rotateLog(path.join(LOG_DIR, name));
  return fs.createWriteStream(path.join(LOG_DIR, name), { flags: 'a' });
}

function buildEnv() {
  const env = Object.assign({}, process.env, fileEnv);
  env.NODE_ENV = 'production';
  env.PORT = String(PORT);
  env.HOSTNAME = '0.0.0.0'; // متاح من الموبايل/الأجهزة على نفس الشبكة
  env.NEXT_TELEMETRY_DISABLED = '1';
  env.DATABASE_URL = 'file:' + DB_PATH.split(path.sep).join('/');
  return env;
}

function preflight() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const missing = [];
  if (!fs.existsSync(ENV_FILE)) missing.push('.env.local');
  if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) missing.push('.next/standalone/server.js');
  if (!fs.existsSync(DB_PATH)) missing.push('db/custom.db');
  if (missing.length) {
    clog('❌ ناقص ملفات أساسية: ' + missing.join(' ، '));
    clog('👉 شغّل install.bat الأول (مرة واحدة) وبعدين start.bat');
    process.exit(1);
  }
}

function portBusy() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('timeout', () => { req.destroy(); resolve(true); });
    req.on('error', () => resolve(false));
  });
}

function waitReady(timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    (function probe() {
      if (stopping) return reject(new Error('stopping'));
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 2000 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
      function retry() {
        if (Date.now() - started > timeoutMs) return reject(new Error('الخادم ماخدش وقت أطول من ' + Math.round(timeoutMs / 1000) + ' ثانية'));
        setTimeout(probe, 2500);
      }
    })();
  });
}

let serverProc = null;
let stopping = false;
let openedBrowser = false;

function writePids() {
  try {
    fs.writeFileSync(path.join(LOG_DIR, 'pids.json'), JSON.stringify({
      supervisor: process.pid,
      server: serverProc ? serverProc.pid : 0,
      port: PORT,
      updated: now(),
    }, null, 2));
  } catch (_) {}
}

function startServer() {
  return new Promise((resolve) => {
    const out = logStream('server.log');
    out.write(`\n===== [${now()}] تشغيل الخادم (supervisor pid ${process.pid}) =====\n`);
    serverProc = spawn(process.execPath, ['server.js'], {
      cwd: STANDALONE,
      env: buildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    writePids();
    clog(`🚀 الخادم اشتغل (PID ${serverProc.pid}) — http://localhost:${PORT}`);
    serverProc.stdout.on('data', (d) => out.write(d));
    serverProc.stderr.on('data', (d) => out.write(d));
    serverProc.on('exit', (code, sig) => {
      out.write(`[${now()}] الخادم وقع code=${code} sig=${sig}\n`);
      out.end();
      serverProc = null;
      if (stopping) return resolve();
      clog(`⚠️ الخادم وقع (${code || sig}) — إعادة تشغيل تلقائية بعد ${RESTART_COOLDOWN_MS / 1000} ثواني`);
      setTimeout(() => { if (!stopping) startServer().then(() => resolve()); }, RESTART_COOLDOWN_MS);
    });
    resolve();
  });
}

/* النبضة — نفس إيقاع نسخة اللينكس بالظبط */
async function tickOnce() {
  const url = `http://127.0.0.1:${PORT}/api/cron/tick?max=5&secret=${encodeURIComponent(TICK_SECRET)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TICK_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ac.signal });
    const body = await res.text().catch(() => '');
    clog(`⏱️  نبضة: HTTP ${res.status} (${Math.round((Date.now() - started) / 1000)}s) ${body.slice(0, 160)}`);
  } catch (e) {
    clog(`⚠️  النبضة فشلت: ${e.name === 'AbortError' ? 'تايم آوت بعد 590s' : e.message}`);
  } finally {
    clearTimeout(t);
  }
}

function scheduleTicks() {
  const run = async () => {
    if (stopping) return;
    await tickOnce();
    setTimeout(run, TICK_INTERVAL_MS);
  };
  setTimeout(run, 15 * 1000); // أول نبضة بعد جهوزية الخادم بـ15 ثانية
}

function doBackup() {
  try {
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const dest = path.join(BACKUP_DIR, `db-${stamp}.db`);
    fs.copyFileSync(DB_PATH, dest);
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, 'db-latest.db'));
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => /^db-\d{4}-\d{2}-\d{2}/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(KEEP_BACKUPS).forEach((x) => { try { fs.unlinkSync(path.join(BACKUP_DIR, x.f)); } catch (_) {} });
    const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
    fs.appendFileSync(path.join(BACKUP_DIR, 'backup.log'), `[${now()}] ${path.basename(dest)} ${size}MB\n`);
    clog(`💾 باك أب: ${path.basename(dest)} (${size}MB) — محتفظ بآخر ${KEEP_BACKUPS}`);
  } catch (e) {
    clog('⚠️  الباك أب فشل: ' + e.message);
  }
}

function scheduleBackups() {
  const run = () => {
    if (stopping) return;
    doBackup();
    setTimeout(run, BACKUP_INTERVAL_MS);
  };
  setTimeout(run, 45 * 1000);
}

function openBrowserOnce() {
  if (openedBrowser) return;
  openedBrowser = true;
  try {
    if (process.platform === 'win32') execSync(`start "" http://localhost:${PORT}`, { shell: 'cmd.exe', stdio: 'ignore' });
    else execSync(`xdg-open http://localhost:${PORT}`, { stdio: 'ignore' });
    clog('🌐 فتحت اللوحة في المتصفح');
  } catch (_) { /* مش مشكلة */ }
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  clog('🛑 بقفل LeadOS... (الباك أبوط محفوظة في backups/)');
  if (serverProc) {
    try { execSync(`taskkill /F /T /PID ${serverProc.pid}`, { stdio: 'ignore' }); }
    catch (_) { try { serverProc.kill(); } catch (_) {} }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (e) => clog('⚠️  استثناء غير متوقع (المشرف كمّل): ' + e.message));
process.on('unhandledRejection', (e) => clog('⚠️  promise مرفوض (المشرف كمّل): ' + (e && e.message ? e.message : e)));

async function main() {
  preflight();
  console.log('');
  console.log('  ════════════════════════════════════════════════');
  console.log('   LeadOS — زيزو وكيل المبيعات الذكي');
  console.log(`   اللوحة:      http://localhost:${PORT}`);
  console.log('   النبضة:      كل 11 دقيقة (معالجة + صيد + زيزو)');
  console.log('   الباك أب:    كل 30 دقيقة → مجلد backups/');
  console.log('   الإيقاف:     stop.bat  أو  Ctrl+C هنا');
  console.log('  ════════════════════════════════════════════════');
  console.log('');

  const busy = await portBusy();
  if (busy) {
    clog(`ℹ️  في سيرفر شغال بالفعل على البورت ${PORT} — مش هشغّل نسخة تانية.`);
    clog('   (لو عايز تعيد التشغيل من الأول: stop.bat وبعدين start.bat)');
    process.exit(0);
  }

  await startServer();
  try { await waitReady(120 * 1000); clog('✅ الخادم جاهز ويرد'); } catch (e) { clog('⚠️  ' + e.message + ' — هكمّل محاولة'); }
  openBrowserOnce();
  scheduleTicks();
  scheduleBackups();
  clog('🟢 المشرف شغال بشكل دائم — سيب النافذة دي مفتوحة (ممكن تصغّرها)');
}

main();
