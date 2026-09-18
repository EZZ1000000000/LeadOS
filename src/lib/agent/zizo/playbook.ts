// LeadOS — منهجية بيع زيزو (Sales Playbook)
// كل مرحلة ليها هدفها وأسلوبها — والهدف النهائي: لايف كول محجوز بميعاد.

export type SaleStage = "NEW" | "ENGAGED" | "INTERESTED" | "OFFERED" | "OBJECTION" | "CALL_BOOKED" | "LOST"

export const STAGES: SaleStage[] = ["NEW", "ENGAGED", "INTERESTED", "OFFERED", "OBJECTION", "CALL_BOOKED", "LOST"]

export interface StageGuide {
  goal: string
  style: string
  must: string[]
  avoid: string[]
}

export const STAGE_GUIDES: Record<SaleStage, StageGuide> = {
  NEW: {
    goal: "العميل يرد عليك ويفتح الكلام",
    style: "خفيف وطبيعي — سؤال واحد قصير، من غير عرض ولا فلوس",
    must: ["افتتاحية من غير سبام", "سبب بسيط لكلامه", "سؤال واحد بس"],
    avoid: ["تفريغ كل الخدمات من أول رسالة", "أسعار", "كلام طويل"],
  },
  ENGAGED: {
    goal: "تعرف شغله وحاجته الحقيقية",
    style: "مستمع شاطر — سؤالين تلاتة قصيرين متفرقين، تعليق بسيط بينهم",
    must: ["اسأل عن بزنسه الأول", "اسأل بيعمل إيه دلوقتي للحاجة دي", "اسمع للرغبة الغلط (بكدح بـ...)"],
    avoid: ["استجواب", "عرض سعر", "كلام تقني كتير"],
  },
  INTERESTED: {
    goal: "يوصله إن الوكالة دي بالظبط اللي تعمل الحاجة دي",
    style: "بثقة وبتجربة — عرض قصير للخدمة المناسبة + مثال حقيقي الشكل + نتيجة",
    must: ["اربط العرض بحاجته اللي قالها هو", "مثال واحد قصير", "اسأله لو عملنا كده معاه هيبقى إيه رأيه"],
    avoid: ["قوائم خدمات كلها", "وعود مضمونة", "تقنية زيادة"],
  },
  OFFERED: {
    goal: "يسحبه لحجز لايف كول بميعاد محدد",
    style: "مباشر برفق — المكالمة ١٠ دقايق، أحسن من كلام طويل في شات",
    must: ["مكالمة قصيرة بميعاد واضح (بكرة/بعد بكرة + ساعة)", "اذكر إن التفاصيل والسعر بيتحددوا في المكالمة", "اقترح ساعتين لو تردد"],
    avoid: ["تفاصيل سعر قافلة في الشات", "انتظار بدون موعد"],
  },
  OBJECTION: {
    goal: "يفض التسبب في التأجيل بدون إلحاح",
    style: "هادي وواثق — بيفهم السبب الأول، وبيرد عليه بحجة بشرية مش خصم",
    must: ["اسأل عن السبب الحقيقي برفق", "غالي؟ → قيمة/تقسيط/نبدأ بمرحلة أصغر", "مفيش وقت؟ → المكالمة ١٠ دقايق بس في وقتك", "هفكر؟ → تمام، أبعلك ملخص صغير تفكر فيه"],
    avoid: ["تنزيل سعر فوري", "إلحاح", "كلام دفاعي طويل"],
  },
  CALL_BOOKED: {
    goal: "يقلل احتمالية عدم الحضور",
    style: "مختصر ومطمن — تأكيد + توضيح بسيط للمكالمة",
    must: ["أكد اليوم والساعة", "قول إيه اللي هيحصل في المكالمة (١٠ دقايق، تفاصيل وسعر)", "لو الأوقات تعارضت، عرض بديل"],
    avoid: ["كلام زيادة", "طلب أي حاجة تانية من العميل"],
  },
  LOST: {
    goal: "يسيب الباب مفتوح من غير إلحاح",
    style: "راجل محترم — رد قصير، ولّي عندنا أي وقت",
    must: ["رد قصير لطيف", "باب مفتوح"],
    avoid: ["إلحاح", "سؤال ليه مش رايح تكمل"],
  },
}

/** إرشاد المرحلة الحالية للبرومبت */
export function stageLine(stage: string, lastReplyBy?: string | null, lastMsgAt?: Date | null): string {
  const st = (STAGES.includes(stage as SaleStage) ? stage : "NEW") as SaleStage
  const g = STAGE_GUIDES[st]
  let wait = ""
  if (lastReplyBy === "ZIZO" && lastMsgAt) {
    const hrs = (Date.now() - lastMsgAt.getTime()) / 3600_000
    if (hrs < 2) wait = " • لسه رديت من قريب — لو مفيش رد جديد من العميل ابعت متابعة خفيفة أو استنى (اعتمد على الوقت المنقضي)"
    else if (hrs < 24) wait = " • العميل ساكت من ساعات — متابعة واحدة خفيفة مطلوبة"
    else wait = " • العميل ساكت من يوم+ — متابعة أخيرة برفق، وبعدها سكوت طويل"
  }
  return `المرحلة: ${st} — هدفك فيها: ${g.goal} • أسلوب: ${g.style} • لازم: ${g.must.join(" ، ")} • ممنوع: ${g.avoid.join(" ، ")}${wait}`
}

/** افتتاحيات المبادرة — زيزو بيبدأ الكلام بنفسه (يتنوّع، مش قالب واحد) */
export const OPENERS: Array<{ text: string; tone: string }> = [
  { text: "أهلاً يا فندم، أنا زيزو من {agency} 👋 شفت شغلكم وصفني — سؤال سريع: بتعملوا إعلانات ولا سايبين على العضلي؟", tone: "مباشر ودود" },
  { text: "مساء الخير، زيزو من {agency}. كان عندي ملاحظة صغيرة على {hint} وحبيت أسألك — وقتكم فاضي ساعة؟", tone: "ملاحظة خفيفة" },
  { text: "أهلاً {name}، أنا زيزو من {agency} — شغالين مع ناس في {industry} على {service} وكان نفسي أعرض عليكم حاجة ممكن تفيدكم. أحكي لك سطرين؟", tone: "عرض مخصص" },
  { text: "سلام عليكم، معاك زيزو من {agency}. بقلب على بزنسات في {city} شغالة في {industry} — شغلكم ظهرلي وحبيت أعرف: منيحتاج أونلاين أكتر ولا مرتاحين للوضع؟", tone: "سؤال سوق" },
]

export function pickOpener(ctx: { agency: string; name?: string; industry?: string; city?: string; service?: string; hint?: string }): string {
  const o = OPENERS[Math.floor(Math.random() * OPENERS.length)]
  return o.text
    .replace("{agency}", ctx.agency)
    .replace("{name}", ctx.name || "يا فندم")
    .replace("{industry}", ctx.industry || "السوق")
    .replace("{city}", ctx.city || "منطقتكم")
    .replace("{service}", ctx.service || "الخدمات")
    .replace("{hint}", ctx.hint || "حضوركم أونلاين")
}

/** هل الرسالة وصلت "لايف كول محجوز"؟ (كشف من كلام زيزو/العميل — بأي ترتيب كلام) */
export function detectBooked(msgs: string[]): string | null {
  const all = msgs.join(" ")
  const hasCall = /(لايف ?كول|مكالمة|مكالمه|كول|call)/i.test(all)
  const hasTime = /(بكرة|بكره|tomorrow|بعده|معاد|الساعة|الساعه|ساعة\s*\d|\d{1,2}\s*[:.٫]\s*\d{2}|بعد\s?العصر|المغرب|بعد المغرب|الصبح|الحادية|التانية|التالته|الرابعه|الرابعة|الخامسه|الخامسة|السادسة|السابعه|السابعة|٠?[١٢٣٤٥٦٧٨٩]|\d{1,2}\s*(ص|م|مساءً|صباحًا))/i.test(all)
  if (hasCall && hasTime) return all.slice(0, 200)
  return null
}

/** استنتاج المرحلة من نص رد زيزو لو ما صرّحش بيها (دراع أمان) */
export function inferStage(msgs: string[], prev: string): string {
  const all = msgs.join(" ")
  if (detectBooked(msgs)) return "CALL_BOOKED"
  // عرض خدمة/مثال/نتيجة → OFFERED لو كنا بعد الاكتشاف
  const offering = /(عندنا|بنعمل|نعملك|خبرة مع|عملنا|مثال|في حالة|خدمة دي|التطبيق ده|الموقع ده)/i.test(all)
  const asking = /\?|؟|إيه|ايه|كام|عدد|بتعمل|شغلكم|شغلك|نطاق/i.test(all)
  const order = ["NEW", "ENGAGED", "INTERESTED", "OFFERED", "OBJECTION", "CALL_BOOKED"]
  let idx = order.indexOf(prev)
  if (idx < 0) idx = 0
  if (offering) idx = Math.max(idx, order.indexOf("OFFERED"))
  else if (asking && idx < order.indexOf("ENGAGED")) idx = order.indexOf("ENGAGED")
  else if (asking) idx = Math.max(idx, order.indexOf("INTERESTED"))
  return order[idx] ?? prev
}
