// عدّ البيانات المعبّأة (تقييم/تليفون/موقع) في بيزنسات ezz
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const ws = await db.workspace.findMany({ select: { id: true, name: true } })
  const ezz = ws.find((w) => w.name === "ezz")!
  const [withRating, withPhone, withSite, total, maps] = await Promise.all([
    db.business.count({ where: { workspaceId: ezz.id, rating: { not: null } } }),
    db.business.count({ where: { workspaceId: ezz.id, phone: { not: null } } }),
    db.business.count({ where: { workspaceId: ezz.id, websiteUrl: { not: null } } }),
    db.business.count({ where: { workspaceId: ezz.id } }),
    db.business.count({ where: { workspaceId: ezz.id, mapsPlaceId: { not: null } } }),
  ])
  console.log(JSON.stringify({ total, withRating, withPhone, withSite, withPlaceId: maps }))

  console.log("== عيّنة بيزنس ببيانات كاملة (لو موجود) ==")
  const full = await db.business.findFirst({ where: { workspaceId: ezz.id, rating: { not: null } }, select: { name: true, rating: true, reviewCount: true, mapsPlaceId: true } })
  console.log(JSON.stringify(full))

  console.log("== أسماء مريبة (noise) في ezz ==")
  const leads = await db.lead.findMany({ where: { workspaceId: ezz.id }, select: { id: true, business: { select: { name: true } } } })
  const noiseRe = /^(شقه|شقة|غرفه|غرفة|محتاج غرفه|محتاج شقه|إيجار|ايجار)|(- LinkedIn$)|‏/u
  const junk = leads.filter((l) => noiseRe.test(l.business.name))
  console.log(`count=${junk.length}`)
  for (const j of junk.slice(0, 12)) console.log(`- ${j.business.name.slice(0, 70)}`)

  await db.$disconnect()
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
