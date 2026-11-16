import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getSlackAdminContext } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await getSlackAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const encryptionKey = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !encryptionKey) {
    return NextResponse.json({
      error: "تنظیمات برنامه Slack کامل نیست. مدیر سامانه باید SLACK_CLIENT_ID، SLACK_CLIENT_SECRET و SLACK_TOKEN_ENCRYPTION_KEY را در Environment سرویس Render ثبت کند."
    }, { status: 503 });
  }
  const state = randomBytes(32).toString("base64url");
  const redirectUri = process.env.SLACK_REDIRECT_URI || new URL("/api/integrations/slack/callback", request.url).toString();
  const authorize = new URL("https://slack.com/oauth/v2/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("scope", "channels:read,channels:history,groups:read,groups:history,users:read");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  const response = NextResponse.redirect(authorize);
  response.cookies.set("danial_slack_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/api/integrations/slack/callback", maxAge: 600,
  });
  return response;
}
