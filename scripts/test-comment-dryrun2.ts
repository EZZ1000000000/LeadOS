// اختبار آليات التعليق (Dry Run) — نسخة ملف نظيفة بدون escaping من bash
import { stealthNavigate, stealthAct } from "../src/lib/agent/stealth-browser"

const postUrl = "https://www.facebook.com/groups/140127849704593/posts/2850452635338754/"

const nav = await stealthNavigate({ url: postUrl, wait_until: "domcontentloaded", timeout: 60_000, scroll_times: 0, session: "fb" })
console.log("فتح المنشور:", nav.ok)

// retry loop: استنى لحد ما صندوق التعليق يظهر (أقصى 30 ثانية)
let boxReady = false
for (let i = 0; i < 10; i++) {
  const probe = await stealthAct({
    action: "eval",
    session: "fb",
    script: `(() => {
      const el = document.querySelector('div[role="textbox"][contenteditable="true"]');
      return el ? { found: true, label: el.getAttribute('aria-label'), len: document.body.innerText.length } : { found: false, len: document.body.innerText.length };
    })()`,
  })
  const r = probe.result as { found: boolean; label?: string; len: number } | undefined
  console.log(`محاولة ${i + 1}: box=${r?.found} len=${r?.len} label=${r?.label?.slice(0, 30)}`)
  if (r?.found) { boxReady = true; break }
  await new Promise((res) => setTimeout(res, 3000))
}
if (!boxReady) { console.log("❌ الصندوق ما ظهرش — الصفحة غيّرت شكلها أو الجلسة وقعت"); process.exit(1) }

// focus عبر eval (click بتاع playwright بيفشل على العنصر المتغيّر — الـfocus البشري أضمن)
const focus = await stealthAct({
  action: "eval",
  session: "fb",
  script: `(() => {
    const el = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.focus();
    el.click();
    return true;
  })()`,
})
console.log("focus:", focus.ok && focus.result === true ? "✅" : "❌")
await new Promise((r) => setTimeout(r, 1200))

// كتابة تدريجية بشرية
const typeScript = `(async () => {
  const el = document.querySelector('div[role="textbox"][contenteditable="true"]');
  if (!el) return false;
  el.focus();
  const txt = "اختبار آلي — سيتم الإلغاء";
  for (const ch of txt) {
    document.execCommand("insertText", false, ch);
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 90));
  }
  return true;
})()`
const typed = await stealthAct({ action: "eval", script: typeScript, session: "fb" })
console.log("كتابة حرف بحرف:", typed.ok && typed.result === true ? "✅" : "❌")

// تحقق إن النص اتحط
const check = await stealthAct({
  action: "eval",
  session: "fb",
  script: `(() => { const el = document.querySelector('div[role="textbox"][contenteditable="true"]'); return el ? (el.innerText || "") : "" })()`,
})
console.log("في الصندوق:", JSON.stringify(check.result).slice(0, 70))

// إلغاء: مسح + Escape — بدون نشر
await stealthAct({
  action: "eval",
  session: "fb",
  script: `(() => { const el = document.querySelector('div[role="textbox"][contenteditable="true"]'); if (el) { el.focus(); document.execCommand("selectAll", false); document.execCommand("delete", false); } return true })()`,
})
await stealthAct({ action: "press", key: "Escape", session: "fb" })
console.log("🧹 اتمسح واتلغى — مفيش حاجة اتنشرت على فيسبوك")
process.exit(0)
