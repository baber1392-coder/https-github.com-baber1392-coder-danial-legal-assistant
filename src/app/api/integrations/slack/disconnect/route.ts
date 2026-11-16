import { NextResponse } from "next/server";
import { decryptSlackToken, getSlackAdminContext, getSlackIntegration, slackApi } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const context = await getSlackAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  try {
    const integration = await getSlackIntegration(context.supabase, context.officeId);
    if (integration) {
      try {
        await slackApi(decryptSlackToken(integration.bot_access_token_encrypted), "auth.revoke");
      } catch (error) {
        console.warn("Slack token revoke returned an error; local credential will still be removed.", error instanceof Error ? error.message : "unknown");
      }
    }
    const { error } = await context.supabase.from("slack_integrations").delete().eq("office_id", context.officeId);
    if (error) return NextResponse.json({ error: "حذف اتصال Slack انجام نشد." }, { status: 500 });
    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json({ error: "قطع اتصال Slack انجام نشد." }, { status: 500 });
  }
}
