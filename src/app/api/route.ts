import { NextResponse } from "next/server";

// LeadOS — /api root: فحص حياة بسيط (بدون أسرار، بدون معلومات حساسة)
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "LeadOS",
    time: new Date().toISOString(),
  });
}
