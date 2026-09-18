// save-fb-cookies.mjs — يحوّل كوكيز فيسبوك (تصدير JSON من إضافة Cookie-Editor)
// إلى نص هيدر Cookie خام ويحفظه في .env باسم FACEBOOK_SESSION_COOKIE
// الاستخدام: node scripts/save-fb-cookies.mjs [مسار-ملف-json]
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const jsonPath = process.argv[2] || "/home/z/my-project/config/fb-session-cookies.json"
const envPath = "/home/z/my-project/.env"

const arr = JSON.parse(readFileSync(jsonPath, "utf8"))
if (!Array.isArray(arr) || !arr.length) {
  console.error("✗ ملف الـJSON فاضي أو مش مصفوفة")
  process.exit(1)
}

// الكوكيز الضرورية للجلسة المسجلة
const names = arr.map((c) => c.name)
const hasCuser = names.includes("c_user")
const hasXs = names.includes("xs")
if (!hasCuser || !hasXs) {
  console.error(`✗ تحذير: كوكيز الجلسة الأساسية ناقصة (c_user=${hasCuser}, xs=${hasXs}) — الجلسة غالبًا مش هتشتغل`)
}

// نص الهيدر: name=value; name2=value2 — القيم زي ما هي (URL-encoded)
const header = arr.map((c) => `${c.name}=${c.value}`).join("; ")

// تواريخ الانتهاء (أقرب انتهاء بين الكوكيز غير-الجلسية)
const exps = arr.filter((c) => !c.session && c.expirationDate).map((c) => c.expirationDate)
const soonest = exps.length ? new Date(Math.min(...exps) * 1000) : null
const latest = exps.length ? new Date(Math.max(...exps) * 1000) : null
const fmt = (d) => d ? d.toISOString().slice(0, 10) : "—"

// تحديث .env: استبدال السطر لو موجود، وإلا إضافة قسم جديد في الآخر
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : ""
const varLine = `FACEBOOK_SESSION_COOKIE=${header}`
const re = /^FACEBOOK_SESSION_COOKIE=.*$/m
if (re.test(env)) {
  env = env.replace(re, varLine)
  console.log("• السطر كان موجود — اتحدث")
} else {
  if (!env.endsWith("\n")) env += "\n"
  env += `\n# ══ جلسة فيسبوك المسجلة (كوكيز) — للجروبات والمراقبة والحقن في المتصفح الستيلث ══\n# مصدرها تصدير Cookie-Editor — النسخة الأصلية JSON: config/fb-session-cookies.json\n${varLine}\n`
  console.log("• قسم جديد اتضاف في .env")
}

writeFileSync(envPath, env, "utf8")

// تقرير بدون تسريب القيم
console.log(`✓ FACEBOOK_SESSION_COOKIE اتحفظ (${arr.length} كوكي)`)
console.log(`  الحساب: c_user=${names.includes("c_user") ? arr.find((c) => c.name === "c_user").value : "مفقود"}`)
console.log(`  أقرب انتهاء (كوكي غير جلسي): ${fmt(soonest)} | أبعد: ${fmt(latest)}`)
console.log(`  الأسماء: ${names.join(", ")}`)
