// save-wa-cookies.mjs — يحفظ كوكيز واتساب ويب في .env باسم WHATSAPP_SESSION_COOKIE
// ملاحظة: الاستهلاك المستقبلي لازم يحقنها بمجال .web.whatsapp.com (مش افتراضي الفيسبوك)
// الاستخدام: node scripts/save-wa-cookies.mjs [مسار-json]
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const jsonPath = process.argv[2] || "/home/z/my-project/config/whatsapp-web-cookies.json"
const envPath = "/home/z/my-project/.env"

const arr = JSON.parse(readFileSync(jsonPath, "utf8"))
if (!Array.isArray(arr) || !arr.length) {
  console.error("✗ ملف الـJSON فاضي أو مش مصفوفة")
  process.exit(1)
}

const names = arr.map((c) => c.name)
if (!names.includes("wa_web_access_token")) {
  console.error("✗ تحذير: مفيش wa_web_access_token — دي مش كوكيز جلسة واتساب ويب مكتملة")
}

const header = arr.map((c) => `${c.name}=${c.value}`).join("; ")

let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : ""
const varLine = `WHATSAPP_SESSION_COOKIE=${header}`
const re = /^WHATSAPP_SESSION_COOKIE=.*$/m
if (re.test(env)) {
  env = env.replace(re, varLine)
  console.log("• السطر كان موجود — اتحدث")
} else {
  if (!env.endsWith("\n")) env += "\n"
  env += `\n# ══ جلسة واتساب ويب (كوكيز) — للتصفح بجلسة حية في المتصفح الستيلث ══\n# النسخة الأصلية JSON: config/whatsapp-web-cookies.json — الحقن لازم بمجال .web.whatsapp.com\n${varLine}\n`
  console.log("• قسم جديد اتضاف في .env")
}

writeFileSync(envPath, env, "utf8")
const exps = arr.filter((c) => !c.session && c.expirationDate).map((c) => c.expirationDate)
const fmt = (d) => d ? new Date(d * 1000).toISOString().slice(0, 10) : "جلسي"
console.log(`✓ WHATSAPP_SESSION_COOKIE اتحفظ (${arr.length} كوكي)`)
console.log(`  الأسماء: ${names.join(", ")}`)
console.log(`  الانتهاء: ${exps.length ? exps.map((e) => new Date(e * 1000).toISOString().slice(0, 10)).join(" / ") : "—"}`)
