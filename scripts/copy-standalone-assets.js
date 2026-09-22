#!/usr/bin/env node
/* LeadOS — نسخ أصول الـstandalone بعد البناء (بديل cross-platform لأمر cp)
   + تصحيح ذاتي: لو الـstandalone اتبنى في مسار متداخل (بسبب جذر Turbopack غلط)
   بيرفع الملفات لمكانها الصحيح قبل النسخ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STANDALONE = path.join(ROOT, '.next', 'standalone');
const SRC_STATIC = path.join(ROOT, '.next', 'static');
const DST_STATIC = path.join(STANDALONE, '.next', 'static');
const SRC_PUBLIC = path.join(ROOT, 'public');
const DST_PUBLIC = path.join(STANDALONE, 'public');

function cp(from, to) {
  if (!fs.existsSync(from)) {
    console.warn('[copy] مش موجود، تخطي: ' + path.relative(ROOT, from));
    return;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log('[copy] ✅ ' + path.relative(ROOT, from) + ' → ' + path.relative(ROOT, to));
}

/* لو server.js مش في جذر الـstandalone مباشرة: دوّر عليه بعمق محدود وارفع محتواه لفوق */
function hoistNestedStandalone() {
  if (fs.existsSync(path.join(STANDALONE, 'server.js'))) return false; // سليم في مكانه — مفيش تصحيح
  if (!fs.existsSync(STANDALONE)) return false;

  function findServer(dir, depth) {
    if (depth > 6) return null;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return null; }
    for (const e of entries) {
      if (e.isFile() && e.name === 'server.js' && dir !== STANDALONE) return dir;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'node_modules') continue;
      const r = findServer(path.join(dir, e.name), depth + 1);
      if (r) return r;
    }
    return null;
  }

  const nested = findServer(STANDALONE, 0);
  if (!nested) return false;

  console.log('[copy] ⚠️  لقيت الـstandalone متداخل في مسار غلط: ' + path.relative(STANDALONE, nested));
  console.log('[copy] جاري رفع الملفات للمكان الصحيح...');
  for (const entry of fs.readdirSync(nested)) {
    const from = path.join(nested, entry);
    const to = path.join(STANDALONE, entry);
    try {
      fs.rmSync(to, { recursive: true, force: true });
      fs.cpSync(from, to, { recursive: true });
    } catch (e) {
      console.warn('[copy] تخطي ' + entry + ': ' + e.message);
    }
  }
  // نضف الشجرة المتداخلة القديمة
  const topRel = path.relative(STANDALONE, nested).split(path.sep)[0];
  if (topRel) fs.rmSync(path.join(STANDALONE, topRel), { recursive: true, force: true });
  return fs.existsSync(path.join(STANDALONE, 'server.js'));
}

if (!fs.existsSync(path.join(ROOT, '.next', 'server', 'server.js')) && !fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
  console.error('[copy] ❌ مفيش نتيجة بناء (.next) — next build نفسه فشل');
  process.exit(1);
}

const hoisted = hoistNestedStandalone();

if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) {
  console.error('[copy] ❌ مش لاقي server.js جوا .next/standalone — جرّب: امسح مجلد .next وشغّل التنصيب تاني');
  process.exit(1);
}

cp(SRC_STATIC, DST_STATIC);
cp(SRC_PUBLIC, DST_PUBLIC);
console.log('[copy] 🎉 أصول الـstandalone جاهزة للتشغيل بـ node .next/standalone/server.js' + (hoisted ? ' (اتصححت تلقائياً)' : ''));
