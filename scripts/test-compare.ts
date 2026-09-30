// مقارنة الوحدة الفعلية بالمنطق المرجعي على نفس الدفعات
import { toHarvested } from "../src/lib/skills/gitskills"
const URL = "https://datasets-server.huggingface.co/rows?dataset=mvaccargiu%2Fgitskills&config=artifacts&split=train"
const offs = Array.from({ length: 4 }, () => Math.floor(Math.random() * 3797000))
for (const off of offs) {
  const res = await fetch(`${URL}&offset=${off}&length=100`)
  const d = await res.json()
  const rows = (d.rows ?? []).map((r) => r.row)
  let moduleHit = 0, contentRows = 0
  const reasons: Record<string, number> = {}
  for (const row of rows) {
    const c = String(row?.content ?? "")
    if (c.length < 80) continue
    contentRows++
    const skill = toHarvested(row)
    if (skill) moduleHit++
    else {
      // سبب الفشل — نفس مراحل الوحدة
      const repo = String(row.repo_full_name ?? "").trim()
      const path = String(row.path ?? "").trim()
      const gate1 = !repo || !path ? "repo/path" : null
      let gate2: string | null = null
      if (!gate1) {
        const name = String((c.match(/^name:\s*(.+)$/m)?.[1]) ?? "").trim() || path.split("/").slice(-2, -1)[0] || ""
        if (!name || name.length < 3) gate2 = "name"
      }
      const key = gate1 ?? gate2 ?? "score/desc"
      reasons[key] = (reasons[key] ?? 0) + 1
    }
  }
  console.log(`offset=${off}: content=${contentRows} moduleHits=${moduleHit} reasons=`, reasons)
}
