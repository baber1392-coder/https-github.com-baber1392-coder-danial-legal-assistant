import { NextResponse } from "next/server";
import { decryptSlackToken, getSlackAdminContext, getSlackIntegration, slackApi } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getSlackAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  try {
    const integration = await getSlackIntegration(context.supabase, context.officeId);
    if (!integration) return NextResponse.json({ error: "اتصال Slack برقرار نشده است." }, { status: 409 });
    const token = decryptSlackToken(integration.bot_access_token_encrypted);
    const result = await slackApi<{ channels?: Array<{ id: string; name: string; is_member?: boolean; is_private?: boolean; num_members?: number }> }>(
      token, "conversations.list", { types: "public_channel,private_channel", exclude_archived: "true", limit: "200" }
    );
    return NextResponse.json({ channels: (result.channels ?? []).map((c) => ({
      id: c.id, name: c.name, isMember: Boolean(c.is_member), isPrivate: Boolean(c.is_private), memberCount: c.num_members ?? null
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "slack_error";
    console.error("Slack channel listing failed", message);
    return NextResponse.json({ error: "دریافت کانال‌ها از Slack انجام نشد. مجوزها و عضویت برنامه در کانال بررسی شود.", code: message }, { status: 502 });
  }
}
