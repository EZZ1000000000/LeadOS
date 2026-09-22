#!/usr/bin/env node
/* LeadOS — إيقاف كل عمليات المشروع (بيتنده من stop.bat)
   1) بيقفل الـPIDs المسجلة في logs/pids.json (المشرف + الخادم)
   2) بيقفل أي عملية سايبة على البورت 3000 احتياطاً */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const killed = new Set();

function killPid(pid) {
  if (!pid || killed.has(pid)) return;
  killed.add(pid);
  try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' }); console.log(`🛑 قفلت العملية ${pid}`); }
  catch (_) { /* العملية مش موجودة — عادي */ }
}

/* 1) من ملف الـPIDs */
try {
  const pids = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs', 'pids.json'), 'utf8'));
  killPid(pids.server);
  killPid(pids.supervisor);
} catch (_) { /* مفيش ملف — عادي */ }

/* 2) أي حاجة سايبة على البورت 3000 */
try {
  const out = execSync('netstat -aon -p tcp | findstr ":3000" | findstr "LISTENING"', { encoding: 'utf8' });
  const pids = new Set(out.split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter((p) => /^\d+$/.test(p)));
  for (const pid of pids) killPid(parseInt(pid, 10));
} catch (_) { /* البورت فاضي أصلاً */ }

if (killed.size === 0) console.log('ℹ️  مفيش عمليات LeadOS شغالة دلوقتي');
else console.log('✅ LeadOS اتقفل بالكامل — شغّله تاني بـ start.bat');
