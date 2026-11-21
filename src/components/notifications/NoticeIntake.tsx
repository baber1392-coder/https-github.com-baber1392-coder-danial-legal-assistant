"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, BellRing, CalendarClock, CheckCircle2, ExternalLink, FileUp, LoaderCircle, ShieldCheck } from "lucide-react";

type CaseOption = { id: string; title: string; case_number: string | null; archive_number: string | null };
type Props = { officeId: string; cases: CaseOption[] };

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp", "text/plain"];

function safeFilename(name: string) {
  return name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-150) || "notice-file";
}

export default function NoticeIntake({ officeId, cases }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [title, setTitle] = useState("ابلاغیه جدید سامانه عدل ایران");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deadlineAt, setDeadlineAt] = useState("");
  const [deadlineType, setDeadlineType] = useState("follow_up");
  const [createDeadline, setCreateDeadline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!caseId) return setError("ابتدا پرونده مرتبط را انتخاب کنید.");
    if (!file) return setError("فایل ابلاغیه یا سند سوابق را انتخاب کنید.");
    if (!ALLOWED_TYPES.includes(file.type)) return setError("نوع فایل پشتیبانی نمی‌شود. PDF، Word، تصویر یا متن مجاز است.");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return setError("حجم فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.");
    if (createDeadline && !deadlineAt) return setError("برای ثبت موعد، تاریخ و ساعت آن را وارد کنید.");

    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("نشست کاربری معتبر نیست. دوباره وارد سامانه شوید.");

      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const { data: duplicate } = await supabase.from("case_documents").select("id,original_filename").eq("office_id", officeId).eq("case_id", caseId).eq("checksum_sha256", checksum).limit(1).maybeSingle();
      if (duplicate) throw new Error(`این فایل قبلاً در همین پرونده ثبت شده است: ${duplicate.original_filename}`);

      const storagePath = `${officeId}/${caseId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("case-documents").upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(`بارگذاری فایل انجام نشد: ${uploadError.message}`);

      const { data: document, error: documentError } = await supabase.from("case_documents").insert({
        office_id: officeId,
        case_id: caseId,
        original_filename: file.name.slice(0, 255),
        content_type: file.type,
        size_bytes: file.size,
        storage_path: storagePath,
        document_type: "notice",
        source_label: "سامانه ابلاغ عدل ایران",
        checksum_sha256: checksum,
        extraction_status: "pending",
        extracted_text: noticeText.trim() || null,
        notes: noticeText.trim() ? "متن ابلاغیه توسط کاربر وارد شده است؛ OCR خودکار انجام نشده." : "فایل دریافت‌شده از سامانه ابلاغ؛ متن هنوز استخراج نشده است.",
        uploaded_by: authData.user.id,
      }).select("id").single();

      if (documentError || !document) {
        await supabase.storage.from("case-documents").remove([storagePath]);
        throw new Error(`ثبت مشخصات سند انجام نشد: ${documentError?.message ?? "خطای نامشخص"}`);
      }

      const description = [
        "منبع: سامانه ابلاغ عدل ایران",
        noticeDate.trim() ? `تاریخ مندرج در ابلاغیه: ${noticeDate.trim()}` : "",
        `شناسه سند بایگانی: ${document.id}`,
        noticeText.trim() ? `متن واردشده توسط کاربر:\n${noticeText.trim()}` : "متن ابلاغیه هنوز استخراج نشده است.",
      ].filter(Boolean).join("\n\n");

      const { error: eventError } = await supabase.from("case_events").insert({
        office_id: officeId,
        case_id: caseId,
        event_type: "notification",
        title: title.trim() || "ابلاغیه جدید",
        description,
        event_at: new Date().toISOString(),
        source: "adliran_manual_import",
        created_by: authData.user.id,
      });
      if (eventError) throw new Error(`سند بارگذاری شد، اما ثبت رویداد پرونده ناموفق بود: ${eventError.message}`);

      if (createDeadline && deadlineAt) {
        const dueAt = new Date(`${deadlineAt}:00+03:30`).toISOString();
        const { error: deadlineError } = await supabase.from("deadlines").insert({
          office_id: officeId,
          case_id: caseId,
          title: `بررسی موعد ابلاغیه: ${title.trim() || "ابلاغیه جدید"}`,
          deadline_type: deadlineType,
          due_at: dueAt,
          status: "open",
          source: "ابلاغیه واردشده دستی از عدل ایران",
          legal_basis: "مهلت درج‌شده در سند؛ نیازمند کنترل و تأیید وکیل",
          verification_status: "needs_review",
          notes: "این موعد به‌صورت دستی از اطلاعات واردشده توسط کاربر ثبت شده و تا زمان بررسی متن ابلاغیه، قطعی تلقی نمی‌شود.",
          created_by: authData.user.id,
          time_zone: "Asia/Tehran",
        });
        if (deadlineError) {
          setSuccess("سند و رویداد پرونده ثبت شدند؛ اما ثبت موعد ناموفق بود. لطفاً موعد را جداگانه در بخش مواعد ثبت کنید.");
          return;
        }
      }

      setSuccess("ابلاغیه با موفقیت در بایگانی خصوصی پرونده ثبت شد. موعد احتمالی با وضعیت «نیازمند بررسی» ذخیره شده است.");
      setTitle("ابلاغیه جدید سامانه عدل ایران");
      setNoticeDate("");
      setNoticeText("");
      setFile(null);
      setDeadlineAt("");
      setCreateDeadline(false);
      const input = document.getElementById("notice-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت ابلاغیه با خطای نامشخص مواجه شد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">د</div><div><b>دستیار دانیال</b><div className="text-xs text-slate-400 mt-1">مدیریت دفتر وکالت</div></div></div>
        <nav className="nav">
          <Link href="/dashboard"><ArrowRight size={17} />نمای کلی</Link>
          <Link href="/dashboard/cases"><FileUp size={17} />پرونده‌ها</Link>
          <Link className="active" href="/dashboard/notifications"><BellRing size={17} />پایش ابلاغیه‌ها</Link>
          <Link href="/dashboard/deadlines"><CalendarClock size={17} />مواعد و جلسات</Link>
        </nav>
        <div className="mt-auto rounded-xl bg-white/10 p-4 text-xs leading-6 text-slate-300">ورود به حساب ثنا فقط توسط صاحب حساب و در دامنه رسمی عدل ایران انجام می‌شود.</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">مرکز دریافت و ثبت دستی</div><h1>پایش ابلاغیه‌ها و سوابق پرونده</h1><p className="muted text-sm mt-2">دریافت توسط شما، تطبیق و ثبت کنترل‌شده در بایگانی دفتر</p></div>
          <a className="btn" href="https://my.adliran.ir/RealPerson/Index" target="_blank" rel="noopener noreferrer">ورود به عدل ایران <ExternalLink size={15} /></a>
        </header>

        <section className="card mb-5">
          <div className="flex items-center gap-3 mb-3"><div className="feature-icon"><ShieldCheck size={20} /></div><div><h2 className="font-bold text-sm">روش ورود امن</h2><p className="text-xs text-slate-500 mt-1">صفحه رسمی در زبانه جداگانه باز می‌شود؛ رمز، کد پیامکی و کدهای بازیابی را در این پنل وارد نکنید.</p></div></div>
          <ol className="text-sm leading-8 text-slate-700 pr-5 list-decimal">
            <li>وارد سامانه رسمی عدل ایران شوید و احراز هویت را شخصاً انجام دهید.</li>
            <li>ابلاغیه یا سابقه پرونده را از خود سامانه دریافت و روی دستگاه خود ذخیره کنید.</li>
            <li>پرونده مرتبط را در فرم زیر انتخاب و فایل را بارگذاری کنید.</li>
            <li>اطلاعات استخراج‌شده را کنترل کنید؛ متن را می‌توانید در کادر مربوط وارد کنید.</li>
          </ol>
        </section>

        <form className="card grid gap-4" onSubmit={submit}>
          <div className="flex items-center gap-3"><div className="feature-icon"><FileUp size={20} /></div><div><h2 className="font-bold">ثبت ابلاغیه یا سابقه جدید</h2><p className="text-xs text-slate-500 mt-1">ثبت نهایی با اقدام صریح شما انجام می‌شود.</p></div></div>
          <label className="field-label">پرونده مرتبط
            <select className="field-input" value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
              <option value="">انتخاب پرونده</option>
              {cases.map((item) => <option key={item.id} value={item.id}>{item.title}{item.case_number ? ` · ${item.case_number}` : ""}{item.archive_number ? ` · بایگانی ${item.archive_number}` : ""}</option>)}
            </select>
          </label>
          <label className="field-label">عنوان رویداد یا ابلاغیه
            <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </label>
          <label className="field-label">تاریخ مندرج در ابلاغیه (اختیاری، با قالب شمسی)
            <input className="field-input" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} placeholder="مثلاً ۱۴۰۵/۰۹/۰۱" />
          </label>
          <label className="field-label">فایل ابلاغیه یا سابقه
            <input id="notice-file" className="field-input" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,application/pdf,image/*,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            <span className="text-xs text-slate-500">حداکثر ۵۰ مگابایت. فایل در مخزن خصوصی اسناد دفتر نگهداری می‌شود.</span>
          </label>
          <label className="field-label">متن ابلاغیه یا متن استخراج‌شده (اختیاری)
            <textarea className="field-input" rows={6} value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="اگر متن PDF را کپی کرده‌اید، اینجا وارد کنید. در این مرحله OCR خودکار انجام نمی‌شود." />
          </label>

          <div className="rounded-xl border border-slate-200 p-4 grid gap-3">
            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={createDeadline} onChange={(e) => setCreateDeadline(e.target.checked)} /> ثبت موعد احتمالی برای بررسی</label>
            {createDeadline && <>
              <label className="field-label">تاریخ و ساعت موعد (بر مبنای ساعت تهران)
                <input className="field-input" type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} required />
              </label>
              <label className="field-label">نوع موعد
                <select className="field-input" value={deadlineType} onChange={(e) => setDeadlineType(e.target.value)}>
                  <option value="follow_up">پیگیری</option><option value="appeal">تجدیدنظرخواهی</option><option value="objection">اعتراض</option><option value="filing">تقدیم لایحه یا دادخواست</option><option value="other">سایر</option>
                </select>
              </label>
              <p className="text-xs text-amber-800 leading-6">موعد با وضعیت «نیازمند بررسی» ثبت می‌شود و تا کنترل متن ابلاغیه، محاسبه یا تأیید قطعی مهلت قانونی محسوب نمی‌شود.</p>
            </>}
          </div>

          {error && <div className="assistant-error" role="alert">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex gap-2"><CheckCircle2 size={18} className="shrink-0" />{success}</div>}
          <button className="btn w-full sm:w-auto" type="submit" disabled={busy || cases.length === 0}>{busy ? <><LoaderCircle className="animate-spin" size={17} /> در حال ثبت...</> : "تأیید و ثبت در پرونده"}</button>
          {cases.length === 0 && <p className="text-sm text-amber-800">هنوز پرونده‌ای در این دفتر ثبت نشده است.</p>}
        </form>
        <p className="text-xs text-slate-500 mt-5 leading-7">توجه: این ماژول در نسخه فعلی دریافت دستی فایل و ثبت کنترل‌شده را انجام می‌دهد. پایش مستقیم و دوره‌ای حساب ثنا هنوز فعال نیست و برای آن به اتصال رسمی یا عامل مرورگر محلیِ مجاز نیاز است.</p>
      </main>
    </div>
  );
}
