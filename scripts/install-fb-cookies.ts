// تركيب كوكيز فيسبوك الجديدة في كل الأماكن + بناء FACEBOOK_SESSION_COOKIE للبيئة
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const RAW = process.argv[2] // ملف JSON فيه مصفوفة الكوكيز
if (!RAW) { console.error("usage: bun scripts/install-fb-cookies.ts <cookies.json>"); process.exit(1) }

const cookies = JSON.parse(readFileSync(RAW, "utf-8")) as Array<{ name: string; value: string; domain?: string }>
if (!Array.isArray(cookies) || !cookies.length) { console.error("مفيش كوكيز في الملف"); process.exit(1) }

const root = "/home/z/my-project"
// 1) config/fb-session-cookies.json — النسخة الكاملة (يستخدمها الستيلث/الكاموفوكس)
writeFileSync(join(root, "config/fb-session-cookies.json"), JSON.stringify(cookies, null, 2))
// 2) worker/state/facebook_cookies.json — نسخة الوركر
const workerState = join(root, "worker/state")
try { writeFileSync(join(workerState, "facebook_cookies.json"), JSON.stringify(cookies, null, 2)) } catch { /* مجلد مش موجود */ }

// 3) .env.local: FACEBOOK_SESSION_COOKIE — سطر cookie header جاهز للفِتش المباشر
const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ")
let env = ""
try { env = readFileSync(join(root, ".env.local"), "utf-8") } catch { /* جديد */ }
const lines = env.split("\n").filter((l) => !/^FACEBOOK_SESSION_COOKIE=/.test(l))
lines.push(`FACEBOOK_SESSION_COOKIE=${header}`)
lines.push(`ZIZO_WHATSAPP=201067804629`)
lines.push(`ZIZO_TELEGRAM=12186496997`)
writeFileSync(join(root, ".env.local"), lines.filter((l) => l !== "").join("\n") + "\n")

const names = cookies.map((c) => c.name)
console.log(`✅ اتركبت ${cookies.length} كوكيز: ${names.join(", ")}`)
console.log(`   c_user موجود: ${names.includes("c_user")} | xs موجود: ${names.includes("xs")} | fr موجود: ${names.includes("fr")}`)
console.log(`   WhatsApp: 201067804629 | Telegram: 12186496997`)
