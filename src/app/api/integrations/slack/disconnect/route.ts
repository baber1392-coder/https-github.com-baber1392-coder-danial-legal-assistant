import { NextResponse } from "next/server";
import { getSlackAdminContext } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const context = await getSlackAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  const { error } = await context.supabase.from("slack_integrations").delete().eq("office_id", context.officeId);
  if (error) return NextResponse.json({ error: "حذف اتصال Slack انجام نشد." }, { status: 500 });
  return NextResponse.json({ disconnected: true });
}
