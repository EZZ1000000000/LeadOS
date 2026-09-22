#!/usr/bin/env node
/* LeadOS — نسخ أصول الـstandalone بعد البناء (بديل cross-platform لأمر cp في اللينكس)
   بيتنادى تلقائياً من npm run build:  next build && node scripts/copy-standalone-assets.js */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_STATIC = path.join(ROOT, '.next', 'static');
const DST_STATIC = path.join(ROOT, '.next', 'standalone', '.next', 'static');
const SRC_PUBLIC = path.join(ROOT, 'public');
const DST_PUBLIC = path.join(ROOT, '.next', 'standalone', 'public');

function cp(from, to) {
  if (!fs.existsSync(from)) {
    console.warn('[copy] مش موجود، تخطي: ' + path.relative(ROOT, from));
    return;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log('[copy] ✅ ' + path.relative(ROOT, from) + ' → ' + path.relative(ROOT, to));
}

if (!fs.existsSync(path.join(ROOT, '.next', 'standalone', 'server.js'))) {
  console.error('[copy] ❌ مش لاقي .next/standalone/server.js — اتأكد إن next.config.ts فيه output: "standalone" وإن البناء نجح');
  process.exit(1);
}
cp(SRC_STATIC, DST_STATIC);
cp(SRC_PUBLIC, DST_PUBLIC);
console.log('[copy] 🎉 أصول الـstandalone جاهزة للتشغيل بـ node .next/standalone/server.js');
