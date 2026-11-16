import { NextResponse } from "next/server";
import { getSlackAdminContext, getSlackIntegration } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getSlackAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  try {
    const integration = await getSlackIntegration(context.supabase, context.officeId);
    return NextResponse.json({
      connected: Boolean(integration),
      teamName: integration?.team_name ?? null,
      teamId: integration?.team_id ?? null,
      installedAt: integration?.installed_at ?? null,
      scopes: integration?.granted_scopes ?? [],
      appConfigured: Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SLACK_TOKEN_ENCRYPTION_KEY),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "خطای نامشخص" }, { status: 500 });
  }
}
