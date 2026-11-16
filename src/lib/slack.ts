import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function getSlackAdminContext() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { error: "برای مدیریت اتصال Slack ابتدا وارد سامانه شوید.", status: 401 as const };
  const { data: membership, error } = await supabase
    .from("office_memberships")
    .select("office_id,role")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (error) return { error: "بررسی دسترسی دفتر انجام نشد.", status: 500 as const };
  if (!membership) return { error: "فقط مالک یا مدیر دفتر مجاز به مدیریت اتصال Slack است.", status: 403 as const };
  return { supabase, user: auth.user, officeId: membership.office_id };
}

function encryptionKey() {
  const secret = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("SLACK_TOKEN_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSlackToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSlackToken(payload: string) {
  const [ivText, tagText, encryptedText] = payload.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored Slack token has an invalid format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export async function getSlackIntegration(supabase: Awaited<ReturnType<typeof createClient>>, officeId: string) {
  const { data, error } = await supabase
    .from("slack_integrations")
    .select("office_id,team_id,team_name,bot_user_id,bot_access_token_encrypted,granted_scopes,installed_at")
    .eq("office_id", officeId)
    .maybeSingle();
  if (error) throw new Error("بازیابی تنظیمات اتصال Slack انجام نشد.");
  return data;
}

export async function slackApi<T = any>(token: string, method: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL("https://slack.com/api/" + method);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) {
    const code = typeof data.error === "string" ? data.error : "slack_api_error";
    throw new Error(code);
  }
  return data as T;
}
