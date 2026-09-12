// LeadOS — مقارنة سكيما الديف (SQLite) بسكيما الإنتاج (PostgreSQL)
// أي موديل/حقل موجود في الديف ومش موجود في الإنتاج = انهيار وقت التشغيل على Vercel
import { readFileSync } from "fs"

const src = (p: string) => readFileSync(p, "utf8")

function parseModels(text: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const re = /^\s*model\s+(\w+)\s*\{([^}]*)\}/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const fields = new Set<string>()
    for (const line of m[2].split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("//") || t.startsWith("@@") || t.startsWith("enum ")) continue
      const fname = t.split(/\s+/)[0]
      if (fname && !["{", "}"].includes(fname)) fields.add(fname)
    }
    out.set(m[1], fields)
  }
  return out
}

const dev = parseModels(src("prisma/schema.prisma"))
const prod = parseModels(src("prisma/schema.production.prisma"))

let issues = 0
for (const [model, fields] of dev) {
  if (!prod.has(model)) { console.log(`❌ موديل ناقص في الإنتاج: ${model}`); issues++; continue }
  const pf = prod.get(model)!
  for (const f of fields) {
    if (!pf.has(f)) { console.log(`  ⚠️ ${model}.${f} ناقص في الإنتاج`); issues++ }
  }
}
for (const model of prod.keys()) {
  if (!dev.has(model)) { console.log(`ℹ️ موديل في الإنتاج فقط: ${model}`) }
}

// مقارنة enum values
function parseEnums(text: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const re = /^\s*enum\s+(\w+)\s*\{([^}]*)\}/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const vals = new Set(m[2].split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((v) => v && v !== "//" && !v.startsWith("//")))
    out.set(m[1], vals)
  }
  return out
}

// الديف SQLite: القيم بتتكتب كنص — ناخد القيم المستخدمة في الكود نفسه
// الإنتاج: قيم الـenum لازم تشمل كل اللي الكود بيكتبه
const prodEnums = parseEnums(src("prisma/schema.production.prisma"))
console.log(`\n=== Enums الإنتاج (${prodEnums.size}) ===`)
for (const [name, vals] of prodEnums) console.log(`  ${name}: ${[...vals].join(", ")}`)

console.log(issues === 0 ? "\n✅ السكيمتين متطابقتان هيكليًا — لا حقول ناقصة" : `\n❌ ${issues} مشكلة يجب إصلاحها`)
process.exit(issues === 0 ? 0 : 1)
