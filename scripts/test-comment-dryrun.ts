// اختبار آليات التعليق — Dry Run: فتح الصندوق + كتابة تدريجية + إلغاء (بدون نشر)
// دي بتثبت إن السلسلة كاملة شغالة: تصفح المنشور → فتح صندوق التعليق → كتابة بشرية
import { db } from "../src/lib/db"
import { stealthNavigate, stealthAct } from "../src/lib/agent/stealth-browser"

// هات أول رابط منشور من أي جروب نشط
const g = await db.monitoredGroup.findFirst({ where: { platform: "FACEBOOK", status: "ACTIVE" } })
if (!g) { console.log("مفيش جروب"); process.exit(1) }
console.log("جروب:", g.name.slice(0, 50))

await stealthNavigate({ url: g.url, wait_until: "domcontentloaded", timeout: 90_000, scroll_times: 1, session: "fb" })
await new Promise((r) => setTimeout(r, 2500))
const links = await stealthAct({
  action: "eval",
  session: "fb",
  script: `Array.from(document.querySelectorAll('div[role="article"] a[href*="/posts/"]')).slice(0,3).map(a => a.href)`,
})
const postLinks = (Array.isArray(links.result) ? links.result : []) as string[]
console.log("روابط منشورات:", postLinks.length)
const postUrl = postLinks[0]
if (!postUrl) { console.log("مفيش لينك منشور"); process.exit(1) }
console.log("المنشور:", postUrl.slice(0, 80))

// افتح المنشور
const nav = await stealthNavigate({ url: postUrl, wait_until: "domcontentloaded", timeout: 60_000, scroll_times: 0, session: "fb" })
console.log("فتح المنشور:", nav.ok)
await new Promise((r) => setTimeout(r, 3000))

// افتح صندوق التعليق
const boxSelectors = [
  'div[role="textbox"][aria-label*="تعليق"]',
  'div[role="textbox"][aria-label*="Comment" i]',
  'div[role="textbox"][contenteditable="true"]',
]
let opened = false
for (const sel of boxSelectors) {
  const click = await stealthAct({ action: "click", selector: sel, session: "fb", timeout: 6_000 })
  console.log("click", sel.slice(0, 45), "→", click.ok)
  if (click.ok) { opened = true; break }
}
if (!opened) { console.log("❌ صندوق التعليق ما اتفتحش"); process.exit(1) }
await new Promise((r) => setTimeout(r, 1500))

// كتابة تدريجية — نص تجريبي واضح إنه اختبار
const testText = "اختبار آلي — سيتم الإلغاء"
const typeScript = `(async () => {
  const el = document.querySelector('div[role="textbox"][contenteditable="true"], textarea[name="comment_text"]');
  if (!el) return false;
  el.focus();
  const txt = ${JSON.stringify(testText)};
  for (const ch of txt) {
    document.execCommand('insertText', false, ch);
    await new Promise(r => setTimeout(r, 30 + Math.random() * 80));
  }
  return true;
})()`
const typed = await stealthAct({ action: "eval", script: typeScript, session: "fb" })
console.log("الكتابة التدريجية:", typed.ok && typed.result === true ? "✅ اتحطت الحرف بحرف" : `❌ ${typed.error ?? typed.result}`)

// تحقق إن النص موجود في الصندوق
const check = await stealthAct({ action: "eval", session: "fb", script: `(() => { const el = document.querySelector('div[role="textbox"][contenteditable="true"], textarea[name="comment_text"]'); return el ? (el.innerText || el.value || '') : '' })()` })
console.log("محتوى الصندوق:", JSON.stringify(check.result).slice(0, 80))

// إلغاء: مسح النص وضغط Escape — مفيش نشر
await stealthAct({ action: "eval", session: "fb", script: `(() => { const el = document.querySelector('div[role="textbox"][contenteditable="true"], textarea[name="comment_text"]'); if (el) { el.focus(); document.execCommand('selectAll', false); document.execCommand('delete', false); } return true })()` })
await stealthAct({ action: "press", key: "Escape", session: "fb" })
console.log("🧹 تم المسح والإلغاء — مفيش حاجة نُشرت")
process.exit(0)
