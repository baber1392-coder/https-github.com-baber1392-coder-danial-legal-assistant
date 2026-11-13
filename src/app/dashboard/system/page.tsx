import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { requireOffice } from "@/lib/supabase/office";

type Check = { label: string; detail: string; state: "ok" | "warn" | "error" };

export default async function SystemHealthPage() {
  const { supabase, office, role } = await requireOffice();
  if (role !== "owner" && role !== "admin") redirect("/dashboard");

  const [officeCheck, casesCheck, membersCheck, documentsCheck, deadlinesCheck] = await Promise.all([
    supabase.from("offices").select("id").eq("id", office.id).maybeSingle(),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("office_id", office.id),
    supabase.from("office_memberships").select("id", { count: "exact", head: true }).eq("office_id", office.id),
    supabase.from("case_documents").select("id", { count: "exact", head: true }).eq("office_id", office.id),
    supabase.from("deadlines").select("id", { count: "exact", head: true }).eq("office_id", office.id),
  ]);

  const checks: Check[] = [
    {
      label: "اتصال پایگاه داده",
      detail: officeCheck.error || !officeCheck.data ? "پاسخ معتبر از جدول دفتر دریافت نشد." : "اتصال احراز‌شده به رکورد دفتر برقرار است.",
      state: officeCheck.error || !officeCheck.data ? "error" : "ok",
    },
    {
      label: "جدول پرونده‌ها",
      detail: casesCheck.error ? "خواندن اطلاعات پرونده‌ها با خطا مواجه شد." : (casesCheck.count ?? 0) + " پرونده ثبت‌شده",
      state: casesCheck.error ? "error" : "ok",
    },
    {
      label: "اعضای دفتر",
      detail: membersCheck.error ? "خواندن عضویت‌ها با خطا مواجه شد." : (membersCheck.count ?? 0) + " عضویت ثبت‌شده",
      state: membersCheck.error ? "error" : "ok",
    },
    {
      label: "اسناد پرونده‌ها",
      detail: documentsCheck.error ? "خواندن فراداده اسناد با خطا مواجه شد." : (documentsCheck.count ?? 0) + " رکورد فراداده سند؛ سلامت فایل‌های ذخیره‌شده جداگانه نیازمند آزمون است.",
      state: documentsCheck.error ? "error" : "ok",
    },
    {
      label: "مواعد و جلسات",
      detail: deadlinesCheck.error ? "خواندن مواعد با خطا مواجه شد." : (deadlinesCheck.count ?? 0) + " موعد ثبت‌شده",
      state: deadlinesCheck.error ? "error" : "ok",
    },
  ];

  const aiProvider = process.env.GROQ_API_KEY ? "Groq" : process.env.GEMINI_API_KEY ? "Gemini" : process.env.OPENAI_API_KEY ? "OpenAI" : null;
  checks.push({
    label: "پیکربندی هوش مصنوعی",
    detail: aiProvider ? "متغیر کلید " + aiProvider + " در محیط سرور موجود است؛ اعتبار و پاسخ واقعی API با این بررسی تأیید نمی‌شود." : "هیچ کلید ارائه‌دهنده هوش مصنوعی در محیط سرور شناسایی نشد.",
    state: aiProvider ? "warn" : "error",
  });

  const stateText = { ok: "فعال", warn: "نیازمند آزمون تکمیلی", error: "نیازمند بررسی" };
  const StateIcon = ({ state }: { state: Check["state"] }) => state === "ok"
    ? <CheckCircle2 className="text-emerald-600" size={19} />
    : state === "warn" ? <AlertTriangle className="text-amber-600" size={19} /> : <XCircle className="text-rose-600" size={19} />;

  return (
    <main className="main max-w-5xl mx-auto">
      <div className="card mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="feature-icon"><Activity size={20} /></div>
            <div><div className="eyebrow">مدیریت فنی دفتر</div><h1 className="mt-1">مرکز کنترل سلامت سامانه</h1></div>
          </div>
          <Link href="/dashboard/system" className="btn secondary"><RefreshCw size={15} /> تازه‌سازی</Link>
        </div>
        <p className="muted text-sm leading-7 mt-3">این صفحه فقط آزمون‌های مجاز با نشست فعلی را اجرا می‌کند. وجود کلید API به معنی داشتن اعتبار یا موفقیت درخواست مدل نیست.</p>
      </div>
      <section className="grid md:grid-cols-2 gap-4">
        {checks.map((check) => (
          <article className="card" key={check.label}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-sm">{check.label}</h2>
              <span className="pill flex items-center gap-2"><StateIcon state={check.state} />{stateText[check.state]}</span>
            </div>
            <p className="text-sm text-slate-500 leading-7 mt-3">{check.detail}</p>
          </article>
        ))}
      </section>
      <section className="card mt-5">
        <h2 className="font-bold text-sm mb-2">آزمون سلامت برنامه</h2>
        <p className="text-sm text-slate-500 leading-7">با بازکردن مسیر زیر، پاسخ ساده سلامت برنامه بررسی می‌شود. این مسیر وضعیت پایگاه داده یا سرویس هوش مصنوعی را به‌تنهایی تضمین نمی‌کند.</p>
        <a href="/api/health" target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline inline-block mt-3">مشاهده پاسخ API سلامت</a>
      </section>
      <p className="text-xs text-slate-400 mt-5">دسترسی این صفحه به مالک و مدیر دفتر محدود است.</p>
    </main>
  );
}
