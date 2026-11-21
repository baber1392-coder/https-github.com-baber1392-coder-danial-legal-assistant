"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight, BellRing, CalendarClock, CheckCircle2, ExternalLink,
  FileText, FileUp, LoaderCircle, ShieldCheck, ScanText, AlertTriangle,
  Clock3, ChevronDown, ChevronUp
} from "lucide-react";

type CaseOption = { id: string; title: string; case_number: string | null; archive_number: string | null };
type NoticeItem = {
  id: string; case_id: string | null; original_filename: string; content_type: string;
  size_bytes: number; created_at: string;
  extraction_status: "pending" | "processing" | "completed" | "failed" | "not_supported";
  extracted_text: string | null; source_label: string | null;
};
type DeadlineItem = {
  id: string; case_id: string | null; title: string; deadline_type: string; due_at: string;
  status: string; verification_status: "verified" | "needs_review"; source: string | null;
};
type Props = { officeId: string; cases: CaseOption[]; notices: NoticeItem[]; deadlines: DeadlineItem[] };
type OcrWorker = {
  recognize: (input: HTMLCanvasElement | File) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const ALLOWED_TYPES = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png", "image/webp", "text/plain"
];

function safeFilename(name: string) {
  return name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-150) || "notice-file";
}

function inferredMimeType(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

function isPdfFile(file: File) { return inferredMimeType(file) === "application/pdf"; }
function isImageFile(file: File) { return inferredMimeType(file).startsWith("image/"); }

function formatTehran(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran"
  }).format(new Date(value));
}

function deadlineState(value: string) {
  const hours = (new Date(value).getTime() - Date.now()) / (60 * 60 * 1000);
  if (hours < 0) return { label: "تاریخ ثبت‌شده گذشته", tone: "danger" };
  if (hours <= 72) return { label: "نزدیک: حداکثر ۳ روز", tone: "danger" };
  if (hours <= 168) return { label: "نزدیک: حداکثر ۷ روز", tone: "warning" };
  return { label: "مهلت باز", tone: "neutral" };
}

function extractionLabel(status: NoticeItem["extraction_status"]) {
  switch (status) {
    case "completed": return "متن استخراج‌شده موجود است";
    case "processing": return "در حال استخراج متن";
    case "failed": return "استخراج متن ناموفق";
    case "not_supported": return "استخراج خودکار پشتیبانی نمی‌شود";
    default: return "در انتظار استخراج متن";
  }
}

export default function NoticeIntake({ officeId, cases, notices, deadlines }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [title, setTitle] = useState("ابلاغیه جدید سامانه عدل ایران");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deadlineAt, setDeadlineAt] = useState("");
  const [deadlineType, setDeadlineType] = useState("follow_up");
  const [createDeadline, setCreateDeadline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState("");
  const [ocrStatus, setOcrStatus] = useState<"idle" | "done" | "failed">("idle");
  const [expandedNoticeIds, setExpandedNoticeIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const caseLabels = useMemo(() => new Map(cases.map((item) => [
    item.id,
    item.title + (item.case_number ? " · " + item.case_number : "") +
      (item.archive_number ? " · بایگانی " + item.archive_number : "")
  ])), [cases]);

  const canRunOcr = Boolean(file && (
    isPdfFile(file) || isImageFile(file) || inferredMimeType(file) === "text/plain"
  ));

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setNoticeText("");
    setOcrProgress(0);
    setOcrMessage("");
    setOcrStatus("idle");
    setError(nextFile && (nextFile.size <= 0 || nextFile.size > MAX_FILE_SIZE)
      ? "حجم فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد."
      : "");
  }

  async function runPersianOcr() {
    if (!file) return setError("ابتدا فایل ابلاغیه را انتخاب کنید.");
    const mimeType = inferredMimeType(file);
    if (!isPdfFile(file) && !isImageFile(file) && mimeType !== "text/plain") {
      return setError("استخراج خودکار متن برای PDF، تصویر و فایل متنی فعال است. متن Word را می‌توانید دستی وارد کنید.");
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return setError("حجم فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.");
    }

    setError("");
    setSuccess("");
    setOcrBusy(true);
    setOcrProgress(0);
    setOcrStatus("idle");
    setOcrMessage("آماده‌سازی موتور استخراج متن فارسی...");
    let worker: OcrWorker | null = null;
    let pdfDocument: { numPages: number; getPage: (pageNumber: number) => Promise<any>; destroy: () => Promise<void> } | null = null;

    try {
      if (mimeType === "text/plain") {
        const text = await file.text();
        if (!text.trim()) throw new Error("فایل متنی خالی است.");
        setNoticeText(text.slice(0, 300000));
        setOcrProgress(100);
        setOcrStatus("done");
        setOcrMessage(text.length > 300000
          ? "استخراج انجام شد؛ فقط ۳۰۰ هزار نویسه نخست در فرم قرار گرفت."
          : "متن فایل خوانده شد. پیش از ثبت آن را بررسی کنید.");
        return;
      }

      const { createWorker } = await import("tesseract.js");
      const createOcrWorker = async (): Promise<OcrWorker> => {
        if (worker) return worker;
        worker = await createWorker("fas+eng", 1, {
          logger: (message: { status?: string; progress?: number }) => {
            if (typeof message.progress === "number") {
              setOcrProgress(Math.min(99, Math.max(0, Math.round(message.progress * 100))));
            }
            if (message.status) setOcrMessage("استخراج فارسی: " + message.status);
          }
        });
        return worker;
      };

      if (isImageFile(file)) {
        const ocrWorker = await createOcrWorker();
        const result = await ocrWorker.recognize(file);
        const text = result.data.text.trim();
        if (!text) throw new Error("متنی از تصویر تشخیص داده نشد. وضوح تصویر را بررسی یا متن را دستی وارد کنید.");
        setNoticeText(text);
        setOcrProgress(100);
        setOcrStatus("done");
        setOcrMessage("استخراج متن تصویر انجام شد. متن تشخیص‌داده‌شده را کنترل کنید.");
        return;
      }

      setOcrMessage("بررسی متن قابل انتخاب PDF و آماده‌سازی صفحات...");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url
      ).toString();

      const bytes = new Uint8Array(await file.arrayBuffer());
      pdfDocument = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
      if (pdfDocument.numPages > MAX_PDF_PAGES) {
        throw new Error("این نسخه حداکثر " + MAX_PDF_PAGES + " صفحه را در هر نوبت پردازش می‌کند. فایل را به چند بخش کوچک‌تر تقسیم کنید.");
      }

      const pageTexts: string[] = [];
      let ocrPageCount = 0;
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const pdfPage = await pdfDocument.getPage(pageNumber);
        const textContent = await pdfPage.getTextContent();
        const textItems = textContent.items as unknown as Array<{ str?: unknown }>;
        const selectableText = textItems
          .map((item) => (typeof item.str === "string" ? item.str : ""))
          .filter(Boolean)
          .join(" ")
          .trim();

        if (selectableText.length >= 40) {
          pageTexts.push("صفحه " + pageNumber + "\n" + selectableText);
        } else {
          ocrPageCount += 1;
          setOcrMessage("در حال OCR صفحه " + pageNumber + " از " + pdfDocument.numPages + "...");
          const viewport = pdfPage.getViewport({ scale: 1.8 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) throw new Error("ساخت بوم پردازش تصویر در مرورگر ممکن نشد.");

          await pdfPage.render({ canvasContext: context, viewport }).promise;
          const ocrWorker = await createOcrWorker();
          const result = await ocrWorker.recognize(canvas);
          const pageText = result.data.text.trim();
          if (pageText) pageTexts.push("صفحه " + pageNumber + "\n" + pageText);
          canvas.width = 0;
          canvas.height = 0;
        }

        await pdfPage.cleanup();
        setOcrProgress(Math.round((pageNumber / pdfDocument.numPages) * 100));
      }

      const finalText = pageTexts.join("\n\n").trim();
      if (!finalText) throw new Error("از PDF متنی استخراج نشد. کیفیت صفحات را بررسی یا متن را دستی وارد کنید.");
      setNoticeText(finalText.slice(0, 300000));
      setOcrStatus("done");
      setOcrMessage(ocrPageCount > 0
        ? "استخراج " + pdfDocument.numPages + " صفحه انجام شد؛ " + ocrPageCount + " صفحه با OCR فارسی پردازش شد. متن را بازبینی کنید."
        : "متن قابل انتخاب PDF استخراج شد. متن را بازبینی کنید.");
      setOcrProgress(100);
    } catch (err) {
      setOcrStatus("failed");
      setOcrMessage("استخراج متن کامل نشد؛ می‌توانید متن را دستی وارد کنید یا فایل را بدون متن ثبت نمایید.");
      setError(err instanceof Error ? err.message : "استخراج متن با خطای نامشخص مواجه شد.");
    } finally {
      if (worker) await worker.terminate().catch(() => undefined);
      if (pdfDocument) await pdfDocument.destroy().catch(() => undefined);
      setOcrBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!caseId) return setError("ابتدا پرونده مرتبط را انتخاب کنید.");
    if (!file) return setError("فایل ابلاغیه یا سند سوابق را انتخاب کنید.");
    if (!ALLOWED_TYPES.includes(inferredMimeType(file))) return setError("نوع فایل پشتیبانی نمی‌شود. PDF، Word، تصویر یا متن مجاز است.");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return setError("حجم فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.");
    if (createDeadline && !deadlineAt) return setError("برای ثبت موعد، تاریخ و ساعت آن را وارد کنید.");
    if (createDeadline && Number.isNaN(new Date(deadlineAt + ":00+03:30").getTime())) return setError("تاریخ و ساعت موعد معتبر نیست.");

    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("نشست کاربری معتبر نیست. دوباره وارد سامانه شوید.");

      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const { data: duplicate } = await supabase.from("case_documents")
        .select("id,original_filename").eq("office_id", officeId)
        .eq("case_id", caseId).eq("checksum_sha256", checksum)
        .limit(1).maybeSingle();

      if (duplicate) throw new Error("این فایل قبلاً در همین پرونده ثبت شده است: " + duplicate.original_filename);

      const storagePath = officeId + "/" + caseId + "/" + crypto.randomUUID() + "-" + safeFilename(file.name);
      const contentType = inferredMimeType(file);
      const { error: uploadError } = await supabase.storage.from("case-documents")
        .upload(storagePath, file, { contentType, upsert: false });
      if (uploadError) throw new Error("بارگذاری فایل انجام نشد: " + uploadError.message);

      const extractedText = noticeText.trim() || null;
      const extractionStatus = extractedText
        ? "completed"
        : ocrStatus === "failed"
          ? "failed"
          : (contentType === "application/msword" || contentType.includes("wordprocessingml"))
            ? "not_supported"
            : "pending";

      const { data: savedDocument, error: documentError } = await supabase.from("case_documents").insert({
        office_id: officeId,
        case_id: caseId,
        original_filename: file.name.slice(0, 255),
        content_type: contentType,
        size_bytes: file.size,
        storage_path: storagePath,
        document_type: "notice",
        source_label: "سامانه ابلاغ عدل ایران",
        checksum_sha256: checksum,
        extraction_status: extractionStatus,
        extracted_text: extractedText,
        extracted_at: extractedText ? new Date().toISOString() : null,
        notes: extractedText
          ? (ocrStatus === "done"
              ? "متن با پردازش محلی مرورگر استخراج شده و پیش از ثبت توسط کاربر قابل بازبینی بوده است."
              : "متن توسط کاربر وارد یا اصلاح شده است.")
          : "فایل دریافت‌شده از سامانه ابلاغ؛ متن هنوز استخراج نشده است.",
        uploaded_by: authData.user.id
      }).select("id").single();

      if (documentError || !savedDocument) {
        await supabase.storage.from("case-documents").remove([storagePath]);
        throw new Error("ثبت مشخصات سند انجام نشد: " + (documentError?.message ?? "خطای نامشخص"));
      }

      const description = [
        "منبع: سامانه ابلاغ عدل ایران",
        noticeDate.trim() ? "تاریخ مندرج در ابلاغیه: " + noticeDate.trim() : "",
        "شناسه سند بایگانی: " + savedDocument.id,
        extractedText ? "متن سند در بخش اسناد پرونده ذخیره شده است." : "متن سند هنوز استخراج نشده است."
      ].filter(Boolean).join("\n\n");

      const { error: eventError } = await supabase.from("case_events").insert({
        office_id: officeId, case_id: caseId, event_type: "notification",
        title: title.trim() || "ابلاغیه جدید", description,
        event_at: new Date().toISOString(), source: "adliran_manual_import",
        created_by: authData.user.id
      });
      if (eventError) throw new Error("فایل در بایگانی ثبت شد، اما ثبت رویداد پرونده ناموفق بود: " + eventError.message);

      let deadlineWarning = "";
      if (createDeadline && deadlineAt) {
        const dueAt = new Date(deadlineAt + ":00+03:30").toISOString();
        const deadlineTitle = ("مهلت ابلاغیه: " + (title.trim() || "ابلاغیه جدید")).slice(0, 200);
        const { error: deadlineError } = await supabase.from("deadlines").insert({
          office_id: officeId, case_id: caseId, title: deadlineTitle,
          deadline_type: deadlineType, due_at: dueAt, status: "open",
          source: "ابلاغیه واردشده دستی از عدل ایران",
          legal_basis: "مهلت درج‌شده در سند؛ نیازمند کنترل و تأیید وکیل",
          verification_status: "needs_review",
          notes: "این موعد به‌صورت دستی ثبت شده و تا زمان بررسی متن ابلاغیه، قطعی تلقی نمی‌شود.",
          created_by: authData.user.id, time_zone: "Asia/Tehran"
        });
        if (deadlineError) deadlineWarning = " سند و رویداد ثبت شدند، اما ثبت موعد ناموفق بود؛ موعد را جداگانه در بخش مواعد ثبت کنید.";
      }

      setSuccess("ابلاغیه در بایگانی خصوصی پرونده ثبت شد." + deadlineWarning);
      setTitle("ابلاغیه جدید سامانه عدل ایران");
      setNoticeDate("");
      setNoticeText("");
      setFile(null);
      setDeadlineAt("");
      setCreateDeadline(false);
      setOcrProgress(0);
      setOcrMessage("");
      setOcrStatus("idle");
      const fileInput = document.getElementById("notice-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت ابلاغیه با خطای نامشخص مواجه شد.");
    } finally {
      setBusy(false);
    }
  }

  function toggleNoticeText(id: string) {
    setExpandedNoticeIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
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
            <li>در صورت نیاز، متن PDF یا تصویر را با OCR فارسی داخل مرورگر استخراج و پیش از ثبت اصلاح کنید.</li>
          </ol>
        </section>

        <section className="card mb-5">
          <div className="section-head" style={{ marginTop: 0 }}>
            <div><h2 className="font-bold">هشدار مهلت‌های پرونده</h2><p className="text-xs text-slate-500 mt-1">موعدهای باز به ترتیب زمان نمایش داده می‌شوند.</p></div>
            <span className="pill">{deadlines.length.toLocaleString("fa-IR")} موعد باز</span>
          </div>
          {deadlines.length === 0 ? <p className="text-sm text-slate-500 py-3">در حال حاضر موعد باز ثبت‌شده‌ای وجود ندارد.</p> : (
            <div className="grid gap-3">
              {deadlines.map((item) => {
                const state = deadlineState(item.due_at);
                return (
                  <article key={item.id} className={"notice-deadline notice-deadline-" + state.tone}>
                    <div className="flex items-start gap-3">
                      <div className="feature-icon"><Clock3 size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm">{item.title}</strong>
                          <span className={"notice-state notice-state-" + state.tone}>{state.label}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{item.case_id ? caseLabels.get(item.case_id) ?? "پرونده مرتبط" : "بدون پرونده متصل"}</p>
                        <p className="text-sm mt-2">مهلت ثبت‌شده: <b>{formatTehran(item.due_at)}</b></p>
                        {item.verification_status !== "verified" && (
                          <p className="text-xs text-amber-800 mt-2 flex items-center gap-2"><AlertTriangle size={14} />نیازمند بررسی و تأیید وکیل؛ این هشدار به‌تنهایی تأیید مهلت قانونی نیست.</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card mb-5">
          <div className="section-head" style={{ marginTop: 0 }}>
            <div><h2 className="font-bold">ابلاغیه‌های ثبت‌شده</h2><p className="text-xs text-slate-500 mt-1">اسناد جدید و وضعیت استخراج متن در این فهرست نمایش داده می‌شوند.</p></div>
            <span className="pill">{notices.length.toLocaleString("fa-IR")} سند</span>
          </div>
          {notices.length === 0 ? <p className="text-sm text-slate-500 py-3">هنوز ابلاغیه‌ای در این بخش ثبت نشده است.</p> : (
            <div className="grid gap-3">
              {notices.map((item) => {
                const expanded = expandedNoticeIds.includes(item.id);
                return (
                  <article key={item.id} className="notice-document">
                    <div className="flex items-start gap-3">
                      <div className="feature-icon"><FileText size={19} /></div>
                      <div className="min-w-0 flex-1">
                        <strong className="text-sm break-words">{item.original_filename}</strong>
                        <p className="text-xs text-slate-500 mt-1">{item.case_id ? caseLabels.get(item.case_id) ?? "پرونده مرتبط" : "بدون پرونده متصل"}</p>
                        <p className="text-xs text-slate-500 mt-1">ثبت: {formatTehran(item.created_at)} · {(item.size_bytes / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="notice-extraction-status">{extractionLabel(item.extraction_status)}</span>
                          {item.extracted_text && (
                            <button type="button" className="btn secondary" onClick={() => toggleNoticeText(item.id)}>
                              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              {expanded ? "بستن متن" : "نمایش متن استخراج‌شده"}
                            </button>
                          )}
                        </div>
                        {expanded && item.extracted_text && <pre className="notice-extracted-text" dir="rtl">{item.extracted_text}</pre>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <form className="card grid gap-4" onSubmit={submit}>
          <div className="flex items-center gap-3"><div className="feature-icon"><FileUp size={20} /></div><div><h2 className="font-bold">ثبت ابلاغیه یا سابقه جدید</h2><p className="text-xs text-slate-500 mt-1">ثبت نهایی با اقدام صریح شما انجام می‌شود.</p></div></div>
          <label className="field-label">پرونده مرتبط
            <select className="field-input" value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
              <option value="">انتخاب پرونده</option>
              {cases.map((item) => <option key={item.id} value={item.id}>{caseLabels.get(item.id)}</option>)}
            </select>
          </label>
          <label className="field-label">عنوان رویداد یا ابلاغیه
            <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </label>
          <label className="field-label">تاریخ مندرج در ابلاغیه (اختیاری، با قالب شمسی)
            <input className="field-input" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} placeholder="مثلاً ۱۴۰۵/۰۹/۰۱" />
          </label>
          <label className="field-label">فایل ابلاغیه یا سابقه
            <input id="notice-file" className="field-input" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,application/pdf,image/*,text/plain" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} required />
            <span className="text-xs text-slate-500">حداکثر ۵۰ مگابایت. فایل در مخزن خصوصی اسناد دفتر نگهداری می‌شود.</span>
          </label>

          {file && (
            <div className="rounded-xl border border-slate-200 p-4 grid gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><ScanText size={18} />استخراج متن فارسی در همین مرورگر</div>
              <p className="text-xs text-slate-600 leading-6">محتوای PDF یا تصویر به سرویس OCR خارجی ارسال نمی‌شود. برای دریافت موتور OCR و داده زبانی فارسی، اتصال اینترنت لازم است. فایل‌های PDF تا ۳۰ صفحه در هر نوبت پردازش می‌شوند.</p>
              <button className="btn secondary w-full sm:w-auto" type="button" onClick={runPersianOcr} disabled={!canRunOcr || ocrBusy || busy}>
                {ocrBusy ? <><LoaderCircle className="animate-spin" size={16} /> در حال استخراج متن...</> : <><ScanText size={16} /> استخراج متن فارسی</>}
              </button>
              {ocrBusy && <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-amber-600 transition-all" style={{ width: ocrProgress + "%" }} /></div>}
              {ocrMessage && <p className={"text-xs leading-6 " + (ocrStatus === "failed" ? "text-rose-700" : "text-slate-600")} role="status">{ocrMessage} {ocrBusy ? ocrProgress.toLocaleString("fa-IR") + "٪" : ""}</p>}
              {!canRunOcr && <p className="text-xs text-slate-500">برای فایل Word، متن را پس از بازکردن سند در کادر زیر وارد کنید.</p>}
            </div>
          )}

          <label className="field-label">متن ابلاغیه یا متن استخراج‌شده (قابل ویرایش)
            <textarea className="field-input" rows={8} value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="پس از استخراج متن، آن را از نظر شماره پرونده، تاریخ‌ها، اعداد و مهلت‌ها بازبینی و اصلاح کنید. متن را می‌توانید دستی نیز وارد کنید." />
            <span className="text-xs text-slate-500">تشخیص OCR قطعی نیست؛ تاریخ و مهلت قانونی را از روی اصل ابلاغیه کنترل کنید.</span>
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
          <button className="btn w-full sm:w-auto" type="submit" disabled={busy || ocrBusy || cases.length === 0}>
            {busy ? <><LoaderCircle className="animate-spin" size={17} /> در حال ثبت...</> : "تأیید و ثبت در پرونده"}
          </button>
          {cases.length === 0 && <p className="text-sm text-amber-800">هنوز پرونده‌ای در این دفتر ثبت نشده است.</p>}
        </form>
        <p className="text-xs text-slate-500 mt-5 leading-7">توجه: این ماژول دریافت دستی فایل و پردازش محلی OCR را انجام می‌دهد. پایش مستقیم و دوره‌ای حساب ثنا هنوز فعال نیست و برای آن به اتصال رسمی یا عامل مرورگر محلیِ مجاز نیاز است.</p>
      </main>
    </div>
  );
}
