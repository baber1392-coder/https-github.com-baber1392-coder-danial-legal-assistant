import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { encryptSlackToken, getSlackAdminContext } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function finish(request: NextRequest, status: string) {
  const response = NextResponse.redirect(new URL("/dashboard/integrations/slack?status=" + encodeURIComponent(status), request.url));
  response.cookies.delete("danial_slack_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const context = await getSlackAdminContext();
  if ("error" in context) return finish(request, "access_denied");
  const expected = request.cookies.get("danial_slack_oauth_state")?.value ?? "";
  const received = request.nextUrl.searchParams.get("state") ?? "";
  if (!expected || !received || expected.length !== received.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return finish(request, "invalid_state");
  if (request.nextUrl.searchParams.get("error")) return finish(request, "cancelled");
  const code = request.nextUrl.searchParams.get("code");
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI || new URL("/api/integrations/slack/callback", request.url).toString();
  if (!code || !clientId || !clientSecret || !process.env.SLACK_TOKEN_ENCRYPTION_KEY) return finish(request, "configuration_error");

  try {
    const form = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true || !result.access_token || !result.team?.id) {
      console.error("Slack OAuth exchange failed", { status: response.status, error: result.error ?? "invalid_oauth_response" });
      return finish(request, "oauth_failed");
    }
    const { error } = await context.supabase.from("slack_integrations").upsert({
      office_id: context.officeId,
      installed_by: context.user.id,
      team_id: result.team.id,
      team_name: result.team.name ?? "Slack workspace",
      bot_user_id: result.bot_user_id ?? null,
      bot_access_token_encrypted: encryptSlackToken(result.access_token),
      granted_scopes: typeof result.scope === "string" ? result.scope.split(",").filter(Boolean) : [],
      installed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "office_id" });
    if (error) {
      console.error("Slack integration save failed", error.message);
      return finish(request, "save_failed");
    }
    return finish(request, "connected");
  } catch (error) {
    console.error("Slack OAuth callback failed", error);
    return finish(request, "callback_failed");
  }
}
