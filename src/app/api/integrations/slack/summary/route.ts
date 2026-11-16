import { NextRequest, NextResponse } from "next/server";
import { decryptSlackToken, getSlackAdminContext, getSlackIntegration, slackApi } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SlackMessage = { text?: string; user?: string; ts?: string; reply_count?: number; thread_ts?: string };

export async function POST(request: NextRequest) {
  const context = await getSlackAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  let body: { channelId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 }); }
  const channelId = typeof body.channelId === "string" ? body.channelId : "";
  if (!/^C[A-Z0-9]+$|^G[A-Z0-9]+$/.test(channelId)) return NextResponse.json({ error: "شناسه کانال معتبر نیست." }, { status: 400 });

  try {
    const integration = await getSlackIntegration(context.supabase, context.officeId);
    if (!integration) return NextResponse.json({ error: "اتصال Slack برقرار نشده است." }, { status: 409 });
    const token = decryptSlackToken(integration.bot_access_token_encrypted);
    const info = await slackApi<{ channel?: { id: string; name: string } }>(token, "conversations.info", { channel: channelId });
    if (!info.channel?.id) return NextResponse.json({ error: "کانال انتخاب‌شده در Workspace متصل پیدا نشد." }, { status: 404 });
    const oldest = String(Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60);
    const history = await slackApi<{ messages?: SlackMessage[]; has_more?: boolean }>(token, "conversations.history", {
      channel: channelId, oldest, limit: "100", inclusive: "true"
    });
    const slackMessages = (history.messages ?? []).filter((m) => typeof m.text === "string" && m.text.trim());
    if (!slackMessages.length) return NextResponse.json({ channel: info.channel.name, messageCount: 0, summary: "در بازه هفت روز گذشته پیام قابل تحلیل در این کانال بازیابی نشد.", decisions: [], owners: [], nextSteps: [], truncated: Boolean(history.has_more) });

    const transcript = slackMessages.reverse().map((m) => {
      const date = m.ts ? new Date(Number(m.ts) * 1000).toISOString() : "";
      return "[" + date + "] " + (m.user ? "<@" + m.user + ">" : "Slack") + ": " + (m.text ?? "");
    }).join("\n").slice(0, 45000);

    const provider = process.env.GROQ_API_KEY ? "groq" : process.env.SAMBANOVA_API_KEY ? "sambanova" : process.env.OPENAI_API_KEY ? "openai" : null;
    if (!provider) return NextResponse.json({ error: "برای تولید خلاصه، یکی از کلیدهای OPENAI_API_KEY، GROQ_API_KEY یا SAMBANOVA_API_KEY در Render تنظیم نشده است." }, { status: 503 });
    const model = provider === "groq" ? (process.env.GROQ_MODEL || "openai/gpt-oss-120b") : provider === "openai" ? (process.env.OPENAI_MODEL || "gpt-6.1-sol") : (process.env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct");
    const messages = [
      { role: "system", content: "You are a precise executive Slack analyst. Analyze only the supplied Slack messages from the last seven days. Respond in Persian. Separate confirmed decisions from suggestions. Never invent owners or deadlines; mark missing values as نامشخص. Return concise Markdown with sections: خلاصه مهم، تصمیمات، مسئولان و تعهدات، گام‌های بعدی، موارد نیازمند پیگیری. Mention message timestamps or Slack user IDs when useful." },
      { role: "user", content: "Workspace: " + integration.team_name + "\nChannel: #" + info.channel.name + "\nMessages:\n" + transcript }
    ];
    let ai: Response;
    {

      const apiKey = provider === "groq" ? process.env.GROQ_API_KEY! : provider === "openai" ? process.env.OPENAI_API_KEY! : process.env.SAMBANOVA_API_KEY!;
      const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.sambanova.ai/v1/chat/completions";
      ai = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model, ...(provider === "openai" ? { max_completion_tokens: 2200 } : { temperature: 0.1, max_tokens: 2200 }), messages }),
        cache: "no-store",
        signal: AbortSignal.timeout(60000)
      });
    }
    const result = await ai.json();
    if (!ai.ok) {
      console.error("Slack summary model failed", { provider, status: ai.status, error: result?.error?.message ?? "unknown" });
      return NextResponse.json({ error: "مدل هوش مصنوعی نتوانست خلاصه Slack را تولید کند." }, { status: 502 });
    }
    const text = result.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "پاسخ خلاصه‌ساز خالی بود." }, { status: 502 });
    return NextResponse.json({
      channel: info.channel.name, messageCount: slackMessages.length, summary: text,
      truncated: Boolean(history.has_more) || transcript.length >= 45000,
      windowDays: 7, provider, generatedAt: new Date().toISOString()
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "slack_error";
    console.error("Slack summary failed", code);
    return NextResponse.json({ error: "بازیابی پیام‌ها یا تحلیل کانال Slack ناموفق بود. دسترسی برنامه به کانال و مجوز history بررسی شود.", code }, { status: 502 });
  }
}
