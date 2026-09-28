import { freshAiQueries, aiSelectPlatforms } from "@/lib/skills/selector"
import { db } from "@/lib/db"
const ws = await db.workspace.findFirst({ select: { id: true } })
if (!ws) throw new Error("no ws")
const fresh = await freshAiQueries(ws.id, "سيستم كاشير للمطاعم في مصر", "QUORA")
console.log("freshAiQueries:", JSON.stringify(fresh))
const picks = await aiSelectPlatforms(ws.id, "سيستم كاشير للمطاعم في مصر", ["QUORA", "EVENTS", "DISCORD", "ADS_LIBRARY", "JOBS", "X", "TIKTOK"], 4)
console.log("aiSelectPlatforms:", JSON.stringify(picks))
