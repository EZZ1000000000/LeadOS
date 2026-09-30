// اختبار مسار التعلم كامل على قاعدة الإنتاج — قبل النشر
import { skillStatsSnapshot, recordSkillRun, recordSkillResults, recordSkillLead, recordLesson, topLessons, skillWeights } from "@/lib/skills/learning"
import { queriesForPlatform } from "@/lib/skills/selector"
import { db } from "@/lib/db"

const ws = await db.workspace.findFirst({ select: { id: true, name: true } })
if (!ws) throw new Error("no workspace")
console.log("workspace:", ws.name)

await recordSkillRun(ws.id, ["QUORA", "JOBS"])
await recordSkillResults(ws.id, { QUORA: 6, JOBS: 1 })
await recordSkillLead(ws.id, "QUORA", { win: true, qualityScore: 72 })
await recordLesson(ws.id, "QUORA", "ازاي اختار سيستم كاشير للمطاعم", { qualityScore: 72 })
const snap = await skillStatsSnapshot(ws.id)
console.log("snapshot:", JSON.stringify(snap))
console.log("weights:", JSON.stringify(await skillWeights(ws.id)))
console.log("lessons:", JSON.stringify(await topLessons(ws.id, "QUORA", 3)))
console.log("queriesForPlatform(JOBS):", JSON.stringify(await queriesForPlatform(ws.id, "JOBS", "سيستم كاشير للمطاعم في مصر")))
