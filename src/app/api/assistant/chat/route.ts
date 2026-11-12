import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_INSTRUCTIONS = `
تو دستیار جامع اختصاصی دانیال، دستیار دفتر وکالت در ایران هستی.
- به فارسی، رسمی، دقیق و بی‌طرف پاسخ بده؛ مگر کاربر زبان دیگری بخواهد.
- در مسائل حقوقی، قوانین جمهوری اسلامی ایران را مبنا قرار بده. ماده، رأی وحدت رویه، نظریه مشورتی، شماره پرونده یا منبع را جعل نکن.
- در پژوهش روزآمد حقوق ایران، با فعال‌بودن جست‌وجوی وب، منابع اولیه رسمی را در اولویت قرار بده: https://ara.jri.ac.ir/ ، https://eadl.ir/vahdatravieh ، https://eadl.ir/nazarmashverati و https://qavanin.ir/ . رأی عادی شعبه را رأی وحدت رویه معرفی نکن و نظریه مشورتی را الزام‌آور ندان.
- بدون فعال بودن جست‌وجوی وب یا منبع ارائه‌شده، ادعای بررسی منابع روزآمد یا مشاهده متن کامل رأی نکن.
- میان واقعیت مستند، اظهار کاربر، استنباط و فرض نیازمند اثبات تفکیک کن.
- اگر اطلاعات یا منبع کافی نیست، روشن بگو و حدس نزن.
- در تحلیل حقوقی: موضوع‌شناسی، تنقیح محل نزاع، ادله موافق، ادله مخالف، نقد و نتیجه را رعایت کن.
- اطلاعات پرونده انتخاب‌شده فقط زمینه پاسخ است؛ هرگز از آن برای استنتاج قطعی فراتر از داده موجود استفاده نکن.
- رمز، OTP، توکن، کوکی نشست و کلیدهای محرمانه را درخواست نکن.
- برای لایحه و متن قضایی، ترجیحات دفتر را رعایت کن: آغاز «خدا هست»، شماره‌گذاری «توجه ۱، توجه ۲، ...» و پایان «مزید تشکر است».
`;

type OfficeContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  officeId: string;
};

async function getOfficeContext(): Promise<OfficeContext | NextResponse> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "برای استفاده از دستیار ابتدا وارد سامانه شوید." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("office_memberships")
    .select("office_id,role")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: "بررسی عضویت دفتر انجام نشد." }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: "برای حساب شما دفتر فعالی ثبت نشده است." }, { status: 403 });
  }
  if (!["owner", "admin", "lawyer", "staff"].includes(membership.role)) {
    return NextResponse.json({ error: "نقش حساب شما اجازه استفاده از دستیار را ندارد." }, { status: 403 });
  }

  return { supabase, user: authData.user, officeId: membership.office_id };
}

function isResponse(value: OfficeContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export async function GET(request: NextRequest) {
  const context = await getOfficeContext();
  if (isResponse(context)) return context;

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (conversationId) {
    const { data: conversation, error: conversationError } = await context.supabase
      .from("ai_chat_conversations")
      .select("id,title")
      .eq("id", conversationId)
      .eq("office_id", context.officeId)
      .eq("created_by", context.user.id)
      .maybeSingle();

    if (conversationError) {
      return NextResponse.json({ error: "بازیابی گفتگو ممکن نشد." }, { status: 500 });
    }
    if (!conversation) {
      return NextResponse.json({ error: "گفتگو پیدا نشد." }, { status: 404 });
    }

    const { data: messages, error: messagesError } = await context.supabase
      .from("ai_chat_messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", conversationId)
      .eq("office_id", context.officeId)
      .eq("created_by", context.user.id)
      .order("created_at", { ascending: true })
      .limit(150);

    if (messagesError) {
      return NextResponse.json({ error: "بازیابی پیام‌ها ممکن نشد." }, { status: 500 });
    }
    return NextResponse.json({ conversation, messages: messages ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const [conversationsResult, casesResult] = await Promise.all([
    context.supabase
      .from("ai_chat_conversations")
      .select("id,title,updated_at")
      .eq("office_id", context.officeId)
      .eq("created_by", context.user.id)
      .order("updated_at", { ascending: false })
      .limit(40),
    context.supabase
      .from("cases")
      .select("id,title,case_number,archive_number,status")
      .eq("office_id", context.officeId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  if (conversationsResult.error || casesResult.error) {
    return NextResponse.json({ error: "دریافت فهرست گفتگوها یا پرونده‌ها انجام نشد." }, { status: 500 });
  }

  return NextResponse.json(
    { conversations: conversationsResult.data ?? [], cases: casesResult.data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const context = await getOfficeContext();
  if (isResponse(context)) return context;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "اتصال مدل هوش مصنوعی هنوز پیکربندی نشده است. مدیر سامانه باید OPENAI_API_KEY را در متغیرهای محرمانه Render ثبت کند." },
      { status: 503 }
    );
  }

  let body: { message?: unknown; conversationId?: unknown; caseId?: unknown; useWebSearch?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست ارسالی معتبر نیست." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 12000) {
    return NextResponse.json({ error: "متن پیام باید بین ۱ تا ۱۲٬۰۰۰ نویسه باشد." }, { status: 400 });
  }

  const rateWindowStart = new Date(Date.now() - 60_000).toISOString();
  const { count: recentUserMessages, error: rateCheckError } = await context.supabase
    .from("ai_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("office_id", context.officeId)
    .eq("created_by", context.user.id)
    .eq("role", "user")
    .gte("created_at", rateWindowStart);

  if (rateCheckError) {
    return NextResponse.json({ error: "بررسی محدودیت درخواست‌ها انجام نشد." }, { status: 500 });
  }
  if ((recentUserMessages ?? 0) >= 8) {
    return NextResponse.json({ error: "برای حفاظت از حساب و هزینه API، حداکثر ۸ پیام در هر دقیقه مجاز است." }, { status: 429 });
  }

  const requestedConversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  let conversationId = requestedConversationId;

  if (conversationId) {
    const { data: existing, error } = await context.supabase
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("office_id", context.officeId)
      .eq("created_by", context.user.id)
      .maybeSingle();

    if (error || !existing) {
      return NextResponse.json({ error: "گفتگوی انتخاب‌شده معتبر نیست." }, { status: 404 });
    }
  } else {
    const title = message.replace(/\s+/g, " ").slice(0, 72) || "گفتگوی جدید";
    const { data: created, error } = await context.supabase
      .from("ai_chat_conversations")
      .insert({
        office_id: context.officeId,
        created_by: context.user.id,
        title,
      })
      .select("id")
      .single();

    if (error || !created) {
      return NextResponse.json({ error: "ایجاد گفتگوی جدید ممکن نشد." }, { status: 500 });
    }
    conversationId = created.id;
  }

  const { error: userMessageError } = await context.supabase
    .from("ai_chat_messages")
    .insert({
      office_id: context.officeId,
      conversation_id: conversationId,
      created_by: context.user.id,
      role: "user",
      content: message,
    });

  if (userMessageError) {
    return NextResponse.json({ error: "ذخیره پیام شما انجام نشد." }, { status: 500 });
  }

  const { data: history, error: historyError } = await context.supabase
    .from("ai_chat_messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .eq("office_id", context.officeId)
    .eq("created_by", context.user.id)
    .order("created_at", { ascending: false })
    .limit(16);

  if (historyError) {
    return NextResponse.json({ error: "بازیابی تاریخچه گفتگو انجام نشد." }, { status: 500 });
  }

  let caseContext = "";
  const caseId = typeof body.caseId === "string" ? body.caseId : null;
  if (caseId) {
    const { data: selectedCase, error: caseError } = await context.supabase
      .from("cases")
      .select("title,case_type,status,subject,court_name,branch_name,case_number,archive_number,execution_number,notes")
      .eq("id", caseId)
      .eq("office_id", context.officeId)
      .maybeSingle();

    if (caseError || !selectedCase) {
      return NextResponse.json({ error: "پرونده انتخاب‌شده در دفتر شما پیدا نشد." }, { status: 404 });
    }

    caseContext = [
      "اطلاعات پرونده انتخاب‌شده توسط کاربر (صرفاً زمینه کمکی؛ منشأ و قطعیت هر داده را رعایت کن):",
      JSON.stringify({
        عنوان: selectedCase.title,
        نوع: selectedCase.case_type,
        وضعیت: selectedCase.status,
        موضوع: selectedCase.subject,
        مرجع: selectedCase.court_name,
        شعبه: selectedCase.branch_name,
        شماره_پرونده: selectedCase.case_number,
        شماره_بایگانی: selectedCase.archive_number,
        شماره_اجرائیه: selectedCase.execution_number,
        یادداشت‌ها: (selectedCase.notes ?? "").slice(0, 6500),
      }),
    ].join("\n");
  }

  const input = (history ?? []).reverse().map((item) => ({
    role: item.role as "user" | "assistant",
    content: item.content,
  }));

  const model = process.env.OPENAI_MODEL || "gpt-6-astra";
  const useWebSearch = body.useWebSearch === true;
  const payload: Record<string, unknown> = {
    model,
    instructions: SYSTEM_INSTRUCTIONS + (caseContext ? "\n\n" + caseContext : ""),
    input,
    store: false,
    max_output_tokens: 3000,
  };
  if (useWebSearch) payload.tools = [{ type: "web_search" }];

  let assistantText = "";
  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });

    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      const apiMessage = typeof result?.error?.message === "string" ? result.error.message : "خطای نامشخص در سرویس هوش مصنوعی";
      console.error("OpenAI API request failed", { status: apiResponse.status, message: apiMessage });
      return NextResponse.json({ error: "پاسخ از سرویس هوش مصنوعی دریافت نشد. تنظیم کلید، مدل و اعتبار حساب API بررسی شود." }, { status: 502 });
    }

    assistantText = (result.output ?? [])
      .filter((item: { type?: string }) => item.type === "message")
      .flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
      .filter((item: { type?: string }) => item.type === "output_text")
      .map((item: { text?: string }) => item.text ?? "")
      .join("\n")
      .trim();

    if (!assistantText) {
      return NextResponse.json({ error: "پاسخ متنی از مدل دریافت نشد." }, { status: 502 });
    }
  } catch (error) {
    console.error("OpenAI API network error", error);
    return NextResponse.json({ error: "ارتباط با سرویس هوش مصنوعی برقرار نشد. اتصال سرور و تنظیمات API بررسی شود." }, { status: 502 });
  }

  const { data: savedAssistant, error: saveAssistantError } = await context.supabase
    .from("ai_chat_messages")
    .insert({
      office_id: context.officeId,
      conversation_id: conversationId,
      created_by: context.user.id,
      role: "assistant",
      content: assistantText.slice(0, 30000),
    })
    .select("id,role,content,created_at")
    .single();

  if (saveAssistantError || !savedAssistant) {
    return NextResponse.json(
      { error: "پاسخ تولید شد، اما ذخیره آن در تاریخچه گفتگو ناموفق بود. دوباره صفحه را بارگذاری کنید." },
      { status: 500 }
    );
  }

  await context.supabase
    .from("ai_chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("office_id", context.officeId)
    .eq("created_by", context.user.id);

  return NextResponse.json({
    conversationId,
    message: savedAssistant,
    model,
    webSearchUsed: useWebSearch,
    caseContextUsed: Boolean(caseContext),
  });
}
