"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Pencil, Plus, Save, ShieldCheck, Trash2, X, Search, Eye, Archive } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type Option = { value: string; label: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Option[];
  placeholder?: string;
};
type CaseOption = { id: string; title: string };

const selectOptions = {
  case_type: [
    { value: "civil", label: "حقوقی" }, { value: "criminal", label: "کیفری" },
    { value: "family", label: "خانواده" }, { value: "commercial", label: "تجاری" },
    { value: "administrative", label: "اداری" }, { value: "execution", label: "اجرای احکام" },
    { value: "registration", label: "ثبتی" }, { value: "other", label: "سایر" },
  ],
  client_type: [{ value: "person", label: "شخص حقیقی" }, { value: "company", label: "شخص حقوقی" }],
  deadline_type: [
    { value: "hearing", label: "جلسه رسیدگی" }, { value: "appeal", label: "تجدیدنظرخواهی" },
    { value: "objection", label: "اعتراض" }, { value: "filing", label: "تقدیم لایحه/دادخواست" },
    { value: "payment", label: "پرداخت" }, { value: "follow_up", label: "پیگیری" }, { value: "other", label: "سایر" },
  ],
  source_type: [
    { value: "statute", label: "قانون و مقرره" }, { value: "unified_ruling", label: "رأی وحدت رویه" },
    { value: "advisory_opinion", label: "نظریه مشورتی" }, { value: "judgment", label: "دادنامه" },
    { value: "administrative_decision", label: "تصمیم اداری" }, { value: "article", label: "مقاله" }, { value: "other", label: "سایر" },
  ],
  record_type: [
    { value: "income", label: "دریافت" }, { value: "expense", label: "هزینه" },
    { value: "refund", label: "استرداد" }, { value: "adjustment", label: "اصلاح حساب" },
  ],
  amount_unit: [{ value: "toman", label: "تومان" }, { value: "rial", label: "ریال" }],
};

const configs: Record<string, { table: string; fields: Field[]; columns: string[]; labels: Record<string, string> }> = {
  cases: {
    table: "cases",
    fields: [
      { name: "title", label: "عنوان پرونده", required: true },
      { name: "case_type", label: "نوع پرونده", type: "select", options: selectOptions.case_type },
      { name: "case_number", label: "شماره پرونده" },
      { name: "archive_number", label: "شماره بایگانی" },
      { name: "execution_number", label: "شماره اجراییه" },
      { name: "court_name", label: "مرجع رسیدگی" },
      { name: "branch_name", label: "شعبه" },
      { name: "subject", label: "خواسته / اتهام / موضوع" },
      { name: "filed_at", label: "تاریخ ثبت", type: "date" },
      { name: "notes", label: "یادداشت", type: "textarea" },
    ],
    columns: ["title", "client_names", "case_number", "archive_number", "court_name", "branch_name", "case_type", "status"],
    labels: { title: "عنوان", client_names: "موکلان", case_number: "شماره پرونده", archive_number: "بایگانی", court_name: "مرجع", branch_name: "شعبه", case_type: "نوع", status: "وضعیت" },
  },
  clients: {
    table: "clients",
    fields: [
      { name: "full_name", label: "نام / عنوان شخص", required: true },
      { name: "client_type", label: "نوع موکل", type: "select", options: selectOptions.client_type },
      { name: "phone", label: "تلفن" },
      { name: "contract_number", label: "شماره قرارداد" },
      { name: "contract_amount", label: "مبلغ قرارداد", type: "number" },
      { name: "contract_amount_unit", label: "واحد مبلغ", type: "select", options: selectOptions.amount_unit },
      { name: "address", label: "نشانی", type: "textarea" },
      { name: "notes", label: "یادداشت", type: "textarea" },
    ],
    columns: ["full_name", "client_type", "phone", "contract_number", "contract_amount", "contract_amount_unit", "created_at"],
    labels: { full_name: "نام", client_type: "نوع", phone: "تلفن", contract_number: "شماره قرارداد", contract_amount: "مبلغ قرارداد", contract_amount_unit: "واحد", created_at: "تاریخ ثبت" },
  },
  deadlines: {
    table: "deadlines",
    fields: [
      { name: "title", label: "عنوان موعد", required: true },
      { name: "deadline_type", label: "نوع موعد", type: "select", options: selectOptions.deadline_type },
      { name: "case_id", label: "پرونده مرتبط", type: "select", options: [] },
      { name: "due_at", label: "تاریخ و ساعت به وقت تهران", type: "datetime-local", required: true },
      { name: "legal_basis", label: "مبنای قانونی", type: "textarea" },
      { name: "source", label: "منبع تاریخ (ابلاغیه/سند)" },
      { name: "notes", label: "توضیحات", type: "textarea" },
    ],
    columns: ["title", "deadline_type", "due_at", "verification_status", "status", "legal_basis"],
    labels: { title: "عنوان", deadline_type: "نوع", due_at: "زمان موعد", verification_status: "اعتبارسنجی", status: "وضعیت", legal_basis: "مبنای قانونی" },
  },
  research: {
    table: "legal_research",
    fields: [
      { name: "title", label: "عنوان منبع", required: true },
      { name: "source_type", label: "نوع منبع", type: "select", options: selectOptions.source_type },
      { name: "source_name", label: "مرجع صادرکننده / ناشر" },
      { name: "source_url", label: "نشانی اینترنتی منبع", type: "url" },
      { name: "reference_number", label: "شماره رأی / نظریه / ماده" },
      { name: "published_at", label: "تاریخ", type: "date" },
      { name: "summary", label: "خلاصه و نکات", type: "textarea" },
    ],
    columns: ["title", "source_type", "source_name", "reference_number", "published_at", "verification_status", "source_url"],
    labels: { title: "عنوان", source_type: "نوع", source_name: "مرجع", reference_number: "شماره", published_at: "تاریخ", verification_status: "وضعیت اعتبار", source_url: "پیوند" },
  },
  finance: {
    table: "financial_records",
    fields: [
      { name: "record_type", label: "نوع گردش", type: "select", options: selectOptions.record_type },
      { name: "amount", label: "مبلغ", type: "number", required: true },
      { name: "amount_unit", label: "واحد پول", type: "select", options: selectOptions.amount_unit },
      { name: "occurred_at", label: "تاریخ گردش", type: "date" },
      { name: "description", label: "شرح", required: true },
      { name: "receipt_reference", label: "شماره رسید / مرجع پرداخت" },
    ],
    columns: ["occurred_at", "record_type", "amount", "amount_unit", "description", "receipt_reference"],
    labels: { occurred_at: "تاریخ", record_type: "نوع", amount: "مبلغ", amount_unit: "واحد", description: "شرح", receipt_reference: "رسید" },
  },
  documents: {
    table: "case_documents",
    fields: [],
    columns: ["original_filename", "document_type", "cases", "content_type", "size_bytes", "created_at"],
    labels: { original_filename: "نام فایل", document_type: "نوع سند", cases: "پرونده مرتبط", content_type: "نوع فایل", size_bytes: "حجم (بایت)", created_at: "تاریخ بارگذاری" },
  },
  settings: {
    table: "office_memberships",
    fields: [],
    columns: ["display_name", "role", "status", "created_at"],
    labels: { display_name: "نام عضو", role: "نقش", status: "وضعیت", created_at: "تاریخ عضویت" },
  },
  "project-archive": {
    table: "project_archive_conversations",
    fields: [],
    columns: ["title", "category", "source_updated_at", "message_count", "case_number_matches", "archive_number_matches", "review_status", "content_available"],
    labels: { title: "عنوان گفتگو", category: "دسته‌بندی", source_updated_at: "آخرین تغییر منبع", message_count: "تعداد پیام", case_number_matches: "شماره پرونده", archive_number_matches: "شماره بایگانی", review_status: "وضعیت بازبینی", content_available: "متن کامل" },
  },
};

function normalizeDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function tehranDateTimeToIso(value: string) {
  const normalized = normalizeDigits(value.trim()).replace(" ", "T");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("تاریخ و ساعت را از پنجره انتخاب تاریخ و ساعت تعیین کنید.");
  const [, year, month, day, hour, minute] = match;
  const y = Number(year), m = Number(month), d = Number(day), h = Number(hour), min = Number(minute);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || h > 23 || min > 59) throw new Error("تاریخ یا ساعت انتخاب‌شده معتبر نیست.");
  return year + "-" + month + "-" + day + "T" + hour + ":" + minute + ":00+03:30";
}

function inputValue(value: unknown, type?: string) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (type === "date") return raw.slice(0, 10);
  if (type === "datetime-local") {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const values: Record<string, string> = {};
    parts.forEach((part) => { values[part.type] = part.value; });
    return values.year + "-" + values.month + "-" + values.day + "T" + values.hour + ":" + values.minute;
  }
  return raw;
}

function displayValue(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join("، ") || "ثبت نشده";
  if (key === "contract_amount" && Number.isFinite(Number(value))) return new Intl.NumberFormat("fa-IR").format(Number(value));
  if (key === "due_at" || key === "occurred_at" || key === "created_at" || key === "updated_at" || key === "source_created_at" || key === "source_updated_at" || key === "next_hearing_at" || key === "extracted_at") {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran",
    }).format(date);
  }
  if (key === "published_at" || key === "filed_at" || key === "document_date") {
    const date = new Date(String(value).slice(0, 10) + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(date);
  }
  const translations: Record<string, string> = {    active: "فعال", pending: "در انتظار", closed: "مختومه", suspended: "متوقف",
    open: "باز", completed: "انجام‌شده", cancelled: "لغوشده",
    needs_review: "نیازمند بررسی", verified: "بررسی‌شده",
    unverified: "تأییدنشده", reviewed: "بازبینی‌شده",
    official_primary_source: "منبع رسمی اولیه",
    civil: "حقوقی", criminal: "کیفری", family: "خانواده", commercial: "تجاری",
    administrative: "اداری", execution: "اجرای احکام", registration: "ثبتی", other: "سایر",
    person: "حقیقی", company: "حقوقی",
    income: "دریافت", expense: "هزینه", refund: "استرداد", adjustment: "اصلاح حساب",
    toman: "تومان", rial: "ریال",
    statute: "قانون", unified_ruling: "رأی وحدت رویه",
    advisory_opinion: "نظریه مشورتی", judgment: "دادنامه",
    administrative_decision: "تصمیم اداری", article: "مقاله",
    hearing: "جلسه رسیدگی", appeal: "تجدیدنظرخواهی", objection: "اعتراض",
    filing: "تقدیم", payment: "پرداخت", follow_up: "پیگیری",
    owner: "مالک دفتر", admin: "مدیر", lawyer: "وکیل", staff: "کارمند",
    accountant: "حسابدار", viewer: "مشاهده‌گر",
    invited: "دعوت‌شده",
    case_matter: "پرونده و موضوع حقوقی", office_system: "مدیریت و توسعه دفتر", legal_research: "پژوهش حقوقی", legal_study: "مطالعات حقوقی",
    imported: "واردشده", library_indexed: "نمایه‌شده در کتابخانه", content_imported: "متن واردشده",
    true: "موجود", false: "موجود نیست",
  };
  return translations[String(value)] ?? String(value);
}

export default function ModuleClient({
  module, title, rows, officeId, userId, role, caseOptions, caseAssignments,
}: {
  module: string;
  title: string;
  rows: Row[];
  officeId: string;
  userId: string;
  role: string;
  caseOptions: CaseOption[];
  caseAssignments: {
    id: string; user_id: string; case_id: string;
    can_read: boolean; can_update: boolean; can_upload: boolean;
  }[];
}) {
  const config = configs[module];
  const router = useRouter();
  const supabase = createClient();
  const [localRows, setLocalRows] = useState<Row[]>(rows);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCase, setSelectedCase] = useState("");
  const [notes, setNotes] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [documentType, setDocumentType] = useState("other");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteCode, setInviteCode] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [accessMemberId, setAccessMemberId] = useState("");
  const [accessCaseId, setAccessCaseId] = useState("");
  const [accessCanUpdate, setAccessCanUpdate] = useState(false);
  const [accessCanUpload, setAccessCanUpload] = useState(false);
  const [newLawyerName, setNewLawyerName] = useState("محمدجعفر کریمی‌زاده");
  const [createdCredential, setCreatedCredential] = useState("");
  const [archiveFilter, setArchiveFilter] = useState("");
  const [selectedArchiveConversation, setSelectedArchiveConversation] = useState<Row | null>(null);

  useEffect(() => { setLocalRows(rows); }, [rows]);
  useEffect(() => {
    const next: Record<string, string> = {};
    config.fields.forEach((field) => {
      next[field.name] = editingRow
        ? inputValue(editingRow[field.name], field.type)
        : field.type === "select" ? (field.options?.[0]?.value ?? "") : "";
    });
    if (editingRow && module === "cases" && !next.case_type) next.case_type = "other";
    setValues(next);
  }, [editingRow, module, config.fields]);

  const columns = config.columns;
  const memberOnly = module === "settings";
  const visibleRows = module === "project-archive"
    ? localRows.filter((row) => {
        const query = normalizeDigits(archiveFilter.trim()).toLocaleLowerCase();
        if (!query) return true;
        const haystack = normalizeDigits([row.title, row.category, row.case_number_matches, row.archive_number_matches].map((value) => Array.isArray(value) ? value.join(" ") : String(value ?? "")).join(" ")).toLocaleLowerCase();
        return haystack.includes(query);
      })
    : localRows;

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload: Row = { office_id: officeId };
      config.fields.forEach((field) => {
        const raw = values[field.name] ?? "";
        if (field.type === "number") payload[field.name] = raw === "" ? null : Number(raw);
        else if (field.type === "datetime-local") payload[field.name] = raw ? tehranDateTimeToIso(raw) : null;
        else if (field.type === "date") payload[field.name] = raw || null;
        else payload[field.name] = raw === "" ? null : raw;
      });

      if (module === "cases") {
        payload.case_type = payload.case_type || "other";
        payload.status = editingRow ? editingRow.status : "active";
      }
      if (module === "clients") payload.client_type = payload.client_type || "person";
      if (module === "deadlines") {
        payload.deadline_type = payload.deadline_type || "other";
        payload.status = editingRow ? editingRow.status : "open";
        payload.verification_status = editingRow ? editingRow.verification_status : "needs_review";
        payload.time_zone = "Asia/Tehran";
      }
      if (module === "research") {
        payload.source_type = payload.source_type || "other";
        payload.verification_status = editingRow ? editingRow.verification_status : "unverified";
      }
      if (module === "finance") {
        payload.amount_unit = payload.amount_unit || "toman";
        payload.occurred_at = values.occurred_at
          ? values.occurred_at + "T12:00:00+03:30"
          : new Date().toISOString();
      }
      if (!editingRow) payload.created_by = userId;

      const table = config.table as "cases" | "clients" | "deadlines" | "legal_research" | "financial_records";
      const result = editingRow
        ? await supabase.from(table).update(payload as never).eq("id", String(editingRow.id)).eq("office_id", officeId)
        : await supabase.from(table).insert(payload as never);

      if (result.error) throw new Error(result.error.message);
      setEditingRow(null);
      setMessage(editingRow ? "تغییرات ذخیره شد." : "رکورد جدید ثبت شد.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره اطلاعات انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function openArchiveConversation(row: Row) {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("project_archive_conversations")
        .select("id,title,content,source_created_at,source_updated_at,message_count,case_number_matches,archive_number_matches,case_id,case_candidate_ids")
        .eq("office_id", officeId)
        .eq("id", String(row.id))
        .eq("content_available", true)
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "متن گفتگو پیدا نشد.");
      const fullContent = String(data.content ?? "");
      setSelectedArchiveConversation({ ...data, content: fullContent.slice(0, 60000), contentTruncated: fullContent.length > 60000, fullContentLength: fullContent.length });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "بازیابی گفتگوی آرشیوی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(row: Row) {
    if (role !== "owner" && role !== "admin") {
      setMessage("حذف پرونده و موکل فقط برای مالک دفتر یا مدیر مجاز است.");
      return;
    }
    const recordId = String(row.id ?? "");
    if (!recordId) return;
    const recordLabel = String(row.title ?? row.full_name ?? "این رکورد");
    if (!window.confirm("آیا از حذف «" + recordLabel + "» اطمینان دارید؟ این عملیات قابل بازگشت نیست.")) return;

    setBusy(true);
    setMessage("");
    try {
      if (module === "cases") {
        const { data: linkedFinance, error: financeError } = await supabase
          .from("financial_records").select("id").eq("office_id", officeId).eq("case_id", recordId).limit(1);
        if (financeError) throw new Error(financeError.message);
        if (linkedFinance?.length) throw new Error("برای این پرونده گردش مالی ثبت شده است. ابتدا ارتباط گردش‌های مالی را تعیین تکلیف کنید؛ پرونده حذف نشد.");

        const { data: docs, error: docsError } = await supabase
          .from("case_documents").select("storage_path").eq("office_id", officeId).eq("case_id", recordId);
        if (docsError) throw new Error(docsError.message);
        const paths = (docs ?? []).map((doc) => doc.storage_path).filter((path): path is string => typeof path === "string" && path.length > 0);
        if (paths.length) {
          const { error: storageError } = await supabase.storage.from("case-documents").remove(paths);
          if (storageError) throw new Error("حذف فایل‌های پرونده از مخزن امن انجام نشد؛ پرونده حذف نشد: " + storageError.message);
        }
      }

      if (module === "clients") {
        const [financeResult, partyResult] = await Promise.all([
          supabase.from("financial_records").select("id").eq("office_id", officeId).eq("client_id", recordId).limit(1),
          supabase.from("case_parties").select("id").eq("office_id", officeId).eq("client_id", recordId).limit(1),
        ]);
        if (financeResult.error) throw new Error(financeResult.error.message);
        if (partyResult.error) throw new Error(partyResult.error.message);
        if (financeResult.data?.length || partyResult.data?.length) {
          throw new Error("این موکل در گردش مالی یا اشخاص پرونده استفاده شده است. ابتدا ارتباط‌های وابسته را تعیین تکلیف کنید؛ موکل حذف نشد.");
        }
      }

      const table = module === "cases" ? "cases" : module === "clients" ? "clients" : null;
      if (!table) throw new Error("حذف در این بخش فعال نیست.");
      const { error } = await supabase.from(table).delete().eq("id", recordId).eq("office_id", officeId);
      if (error) throw new Error(error.message);
      setLocalRows((current) => current.filter((item) => String(item.id) !== recordId));
      if (editingRow && String(editingRow.id) === recordId) setEditingRow(null);
      setMessage(module === "cases" ? "پرونده و اطلاعات وابسته آن حذف شد." : "موکل و ارتباط‌های وابسته آن حذف شد.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حذف انجام نشد.");
    } finally {      setBusy(false);
    }
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setMessage("ابتدا فایل موردنظر را انتخاب کنید.");
      return;
    }
    if (!selectedCase) {
      setMessage("انتخاب پرونده مرتبط الزامی است.");
      return;
    }
    if (selectedFile.size <= 0 || selectedFile.size > 50 * 1024 * 1024) {
      setMessage("حجم فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.");
      return;
    }

    setBusy(true);
    setMessage("");
    const safeName = selectedFile.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 180) || "document";
    const path = officeId + "/" + selectedCase + "/" + crypto.randomUUID() + "/" + safeName;
    try {
      const { error: uploadError } = await supabase.storage
        .from("case-documents")
        .upload(path, selectedFile, { upsert: false, contentType: selectedFile.type || "application/octet-stream" });
      if (uploadError) throw new Error(uploadError.message);

      const extractedText = selectedFile.type === "text/plain" || selectedFile.name.toLowerCase().endsWith(".txt")
        ? (await selectedFile.text()).slice(0, 200000)
        : null;
      const { error: metadataError } = await supabase.from("case_documents").insert({
        office_id: officeId,
        case_id: selectedCase,
        document_type: documentType,
        extracted_text: extractedText,
        extraction_status: extractedText ? "completed" : "pending",
        extracted_at: extractedText ? new Date().toISOString() : null,
        original_filename: selectedFile.name.slice(0, 255),
        content_type: selectedFile.type || "application/octet-stream",
        size_bytes: selectedFile.size,
        storage_path: path,
        notes: notes || null,
        uploaded_by: userId,
      });

      if (metadataError) {
        await supabase.storage.from("case-documents").remove([path]);
        throw new Error(metadataError.message);
      }
      setSelectedFile(null);
      setSelectedCase("");
      setNotes("");
      setFileInputKey((value) => value + 1);
      setMessage("سند با موفقیت به پرونده انتخاب‌شده متصل و در مخزن خصوصی دفتر ذخیره شد.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "بارگذاری سند انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadDocument(row: Row) {
    const path = String(row.storage_path ?? "");
    if (!path) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from("case-documents").createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "پیوند دریافت سند ایجاد نشد.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "دریافت سند انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function createLawyerAccount() {
    setBusy(true);
    setMessage("");
    setCreatedCredential("");
    try {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
      const random = new Uint32Array(28);
      crypto.getRandomValues(random);
      const password = Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
      const { data, error } = await supabase.functions.invoke("create-office-lawyer", {
        body: { display_name: newLawyerName, username: newLawyerName === "محمدجعفر کریمی‌زاده" ? "mkarimizadeh" : "hsafari", office_id: officeId, password },
      });
      if (error) throw new Error("ایجاد حساب انجام نشد. وضعیت اتصال و مجوز مدیر دفتر بررسی شود.");
      if (!data?.success) throw new Error(data?.error ?? "ایجاد حساب انجام نشد.");
      setCreatedCredential((newLawyerName === "محمدجعفر کریمی‌زاده" ? "mkarimizadeh" : "hsafari") + " | " + password);
      setMessage("حساب وکیل ایجاد شد. گذرواژه موقت فقط در همین صفحه نمایش داده می‌شود.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ایجاد حساب انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function grantCaseAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessMemberId || !accessCaseId) {
      setMessage("انتخاب وکیل و پرونده الزامی است.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await (supabase as any).from("case_user_access").upsert({
        office_id: officeId,
        case_id: accessCaseId,
        user_id: accessMemberId,
        can_read: true,
        can_update: accessCanUpdate,
        can_upload: accessCanUpload,
        granted_by: userId,
      }, { onConflict: "case_id,user_id" });
      if (error) throw new Error(error.message);
      setMessage("دسترسی پرونده‌ای ثبت شد.");
      setAccessCanUpdate(false);
      setAccessCanUpload(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ثبت دسترسی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (memberOnly) {
    const lawyers = localRows.filter((row) => row.role === "lawyer" && row.status === "active");
    return (
      <div className="space-y-5">
        <section className="card">
          <h2 className="font-bold mb-3">ایجاد حساب وکیل</h2>
          <p className="text-sm text-slate-500 leading-7 mb-4">حساب مستقل با نام کاربری فارسی ایجاد می‌شود. گذرواژه موقت قوی به‌صورت خودکار ساخته و فقط یک‌بار نمایش داده می‌شود.</p>
          <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
            <label className="field-label">نام و نام خانوادگی عضو
              <select value={newLawyerName} onChange={(event) => setNewLawyerName(event.target.value)} className="field-input">
                <option value="محمدجعفر کریمی‌زاده">محمدجعفر کریمی‌زاده</option>
                <option value="حسین صفری">حسین صفری</option>
              </select>
            </label>
            <button type="button" disabled={busy} onClick={createLawyerAccount} className="rounded-xl bg-[#10243a] text-white px-5 py-3 disabled:opacity-60">{busy ? "در حال ایجاد..." : "ایجاد حساب وکیل"}</button>
          </div>
          {createdCredential && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-bold mb-2">اطلاعات ورود موقت، همین حالا یادداشت و به وکیل تحویل شود</p>
            <textarea readOnly rows={2} value={createdCredential} className="w-full rounded-lg border p-2 text-sm" dir="auto" />
          </div>}
        </section>
        <section className="card">
          <h2 className="font-bold mb-3">اعضای دفتر</h2>
          <p className="text-sm text-slate-500 leading-7 mb-4">فهرست اعضا و نقش‌های ثبت‌شده در دفتر.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{columns.map((key) => <th className="text-right p-3 border-b" key={key}>{config.labels[key] ?? key}</th>)}</tr></thead>
              <tbody>{localRows.map((row) => <tr key={String(row.id)}>{columns.map((key) => <td className="p-3 border-b border-slate-100" key={key}>{displayValue(row[key], key)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h2 className="font-bold mb-2">تخصیص دسترسی پرونده‌ای</h2>
          <p className="text-sm text-slate-500 leading-7 mb-4">وکیل فقط پرونده‌هایی را مشاهده می‌کند که در این بخش به حساب او تخصیص داده شده باشد. دسترسی خواندن به‌صورت پیش‌فرض فعال است.</p>
          <form onSubmit={grantCaseAccess} className="grid md:grid-cols-2 gap-4">
            <label className="field-label">وکیل
              <select required value={accessMemberId} onChange={(event) => setAccessMemberId(event.target.value)} className="field-input">
                <option value="">انتخاب وکیل</option>
                {lawyers.map((row) => <option key={String(row.user_id)} value={String(row.user_id)}>{String(row.display_name ?? row.user_id)}</option>)}
              </select>
            </label>
            <label className="field-label">پرونده
              <select required value={accessCaseId} onChange={(event) => setAccessCaseId(event.target.value)} className="field-input">
                <option value="">انتخاب پرونده</option>
                {caseOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={accessCanUpdate} onChange={(event) => setAccessCanUpdate(event.target.checked)} /> اجازه ویرایش اطلاعات پرونده</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={accessCanUpload} onChange={(event) => setAccessCanUpload(event.target.checked)} /> اجازه بارگذاری اسناد</label>
            <div className="md:col-span-2"><button disabled={busy} className="rounded-xl bg-[#10243a] text-white px-5 py-3 disabled:opacity-60">{busy ? "در حال ثبت..." : "ثبت دسترسی"}</button></div>
          </form>
          {message && <p role="status" className="text-sm mt-3 text-slate-600">{message}</p>}
        </section>
        <section className="card">
          <h2 className="font-bold mb-3">دسترسی‌های ثبت‌شده</h2>
          {caseAssignments.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">هنوز دسترسی پرونده‌ای ثبت نشده است.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>
                  <th className="text-right p-3 border-b">وکیل</th>
                  <th className="text-right p-3 border-b">پرونده</th>
                  <th className="text-right p-3 border-b">مشاهده</th>
                  <th className="text-right p-3 border-b">ویرایش</th>
                  <th className="text-right p-3 border-b">بارگذاری سند</th>
                </tr></thead>
                <tbody>
                  {caseAssignments.map((assignment) => {
                    const member = localRows.find((row) => String(row.user_id) === assignment.user_id);
                    const caseItem = caseOptions.find((item) => item.id === assignment.case_id);
                    return (
                      <tr key={assignment.id}>
                        <td className="p-3 border-b">{String(member?.display_name ?? "عضو نامشخص")}</td>
                        <td className="p-3 border-b">{caseItem?.title ?? "پرونده نامشخص"}</td>
                        <td className="p-3 border-b">{assignment.can_read ? "مجاز" : "غیرمجاز"}</td>
                        <td className="p-3 border-b">{assignment.can_update ? "مجاز" : "غیرمجاز"}</td>
                        <td className="p-3 border-b">{assignment.can_upload ? "مجاز" : "غیرمجاز"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {module === "project-archive" ? (
        <section className="card">
          <div className="flex items-center gap-3 mb-3"><div className="feature-icon"><Archive size={19} /></div><div><h2 className="font-bold">آرشیو واردشده از ChatGPT</h2><p className="text-xs text-slate-500 mt-1">۱۲۴ گفتگوی پالایش‌شده با ۲٬۹۸۶ پیام؛ متن‌ها در پایگاه داده دفتر نگهداری می‌شوند.</p></div></div>
          <label className="field-label">جست‌وجو در عنوان، شماره پرونده و بایگانی
            <div className="relative"><Search size={16} className="absolute right-3 top-3 text-slate-400" /><input value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value)} placeholder="نام موکل، شماره پرونده یا موضوع را وارد کنید" className="field-input pr-9" /></div>
          </label>
          <p className="text-xs text-slate-500 mt-3 leading-6">ارتباط برخی گفتگوها با بیش از یک پرونده صرفاً نامزد است. پیام‌های کاربر از پاسخ‌های قبلی دستیار تفکیک شده‌اند؛ پاسخ‌های قبلی مدل سند اثباتی محسوب نمی‌شوند.</p>
        </section>
      ) : module === "documents" ? (
        <section className="card">
          <div className="flex items-center gap-3 mb-4"><div className="feature-icon"><FileUp size={19} /></div><div><h2 className="font-bold">بارگذاری سند جدید</h2><p className="text-xs text-slate-500 mt-1">فایل در مخزن خصوصی دفتر نگهداری می‌شود؛ نشانی عمومی برای آن ساخته نمی‌شود.</p></div></div>
          <form onSubmit={uploadDocument} className="grid md:grid-cols-2 gap-4">
            <label className="field-label">فایل
              <input key={fileInputKey} type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="field-input" />
            </label>
            <label className="field-label">پرونده مرتبط
              <select required value={selectedCase} onChange={(event) => setSelectedCase(event.target.value)} className="field-input">
                <option value="">انتخاب پرونده الزامی است</option>
                {caseOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="field-label">نوع سند
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="field-input">
                <option value="other">سایر</option><option value="petition">دادخواست</option><option value="brief">لایحه</option><option value="judgment">دادنامه</option><option value="notice">ابلاغیه</option><option value="contract">قرارداد</option><option value="evidence">مدرک و دلیل</option><option value="expert_report">نظریه کارشناسی</option><option value="receipt">رسید</option><option value="correspondence">مکاتبه</option>
              </select>
            </label>
            <label className="field-label md:col-span-2">یادداشت
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="field-input" />
            </label>
            <div className="md:col-span-2 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-slate-500">حداکثر حجم: ۵۰ مگابایت · PDF، Word، Excel، JPG، PNG، WEBP و TXT</span>
              <button disabled={busy} className="btn"><FileUp size={16} />{busy ? "در حال بارگذاری..." : "بارگذاری امن"}</button>
            </div>
          </form>
        </section>
      ) : (
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="feature-icon"><Plus size={19} /></div>
            <div><h2 className="font-bold">{editingRow ? "ویرایش رکورد" : "ثبت رکورد جدید"}</h2><p className="text-xs text-slate-500 mt-1">دسترسی و محدوده ثبت اطلاعات در پایگاه داده نیز کنترل می‌شود.</p></div>
          </div>
          <form onSubmit={saveRecord} className="grid md:grid-cols-2 gap-4">
            {config.fields.map((field) => (
              <label className={"field-label" + (field.type === "textarea" ? " md:col-span-2" : "")} key={field.name}>
                {field.label}
                {field.name === "case_id" ? (
                  <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="field-input">
                    <option value="">بدون اتصال به پرونده</option>
                    {caseOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                ) : field.options ? (
                  <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="field-input">
                    {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea required={field.required} rows={3} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="field-input" />
                ) : (
                  <input required={field.required} type={field.type ?? "text"} lang="fa-IR" dir={field.type === "date" || field.type === "datetime-local" ? "ltr" : undefined} step={field.type === "number" ? "any" : undefined} min={field.type === "number" ? "0" : undefined} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="field-input" />
                )}
              </label>
            ))}
            <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
              <button disabled={busy} className="btn"><Save size={16} />{busy ? "در حال ذخیره..." : editingRow ? "ذخیره تغییرات" : "ثبت اطلاعات"}</button>
              {editingRow && <button type="button" onClick={() => setEditingRow(null)} className="btn secondary"><X size={16} />انصراف از ویرایش</button>}
            </div>
          </form>
        </section>
      )}

      {message && <div className="card text-sm leading-7" role="status">{message}</div>}

      {module === "project-archive" && selectedArchiveConversation && (
        <section className="card">
          <div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-bold">{String(selectedArchiveConversation.title ?? "گفتگوی آرشیوی")}</h2><p className="text-xs text-slate-500 mt-1">{displayValue(selectedArchiveConversation.source_updated_at, "source_updated_at")} · {displayValue(selectedArchiveConversation.message_count, "message_count")} پیام</p></div><button type="button" onClick={() => setSelectedArchiveConversation(null)} className="btn secondary"><X size={15} />بستن</button></div>
          <p className="text-xs text-slate-500 mb-3">متن نقش‌محور گفتگو. پیام‌های USER اظهارات قبلی کاربر و پیام‌های ASSISTANT خروجی مدل در زمان گذشته هستند.</p>
          {Boolean(selectedArchiveConversation.contentTruncated) && <p className="text-xs text-amber-700 mb-2">برای نمایش سریع، متن به ۶۰٬۰۰۰ نویسه نخست محدود شده است؛ نسخه کامل در آرشیو پایگاه داده نگهداری می‌شود.</p>}
          <pre dir="auto" className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6">{String(selectedArchiveConversation.content ?? "")}</pre>
        </section>
      )}

      <section className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div><h2 className="font-bold">فهرست {title}</h2><p className="text-xs text-slate-500 mt-1">{module === "project-archive" ? "حداکثر ۲۵۰ گفتگوی آرشیوی نمایش داده می‌شود." : "حداکثر ۱۰۰ رکورد اخیر نمایش داده می‌شود."}</p></div>
          <span className="pill">{visibleRows.length} رکورد</span>
        </div>
        {visibleRows.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">هنوز رکوردی ثبت نشده است.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{columns.map((key) => <th className="text-right p-3 border-b whitespace-nowrap" key={key}>{config.labels[key] ?? key}</th>)}<th className="p-3 border-b">{module === "project-archive" ? "نمایش" : "عملیات"}</th></tr></thead>
              <tbody>
                {module === "cases" ? (() => {
                  const groups = new Map<string, Row[]>();
                  [...localRows].sort((a, b) => {
                    const nameA = typeof a.client_names === "string" && a.client_names.trim() ? a.client_names.trim() : "پرونده‌های شخصی دانیال رحیمی";
                    const nameB = typeof b.client_names === "string" && b.client_names.trim() ? b.client_names.trim() : "پرونده‌های شخصی دانیال رحیمی";
                    return nameA.localeCompare(nameB, "fa");
                  }).forEach((row) => {
                    const key = typeof row.client_names === "string" && row.client_names.trim()
                      ? row.client_names.trim()
                      : "پرونده‌های شخصی دانیال رحیمی";
                    groups.set(key, [...(groups.get(key) ?? []), row]);
                  });
                  return Array.from(groups.entries()).map(([clientName, group]) => (
                    <Fragment key={clientName}>
                      <tr className="bg-slate-100 border-y-2 border-slate-300">
                        <td colSpan={columns.length + 1} className="px-4 py-3 font-bold text-slate-800">
                          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />{clientName}</span>
                          <span className="mr-3 rounded-full bg-white border px-2.5 py-1 text-xs font-medium text-slate-600">{group.length} پرونده</span>
                        </td>
                      </tr>
                      {group.map((row) => (
                        <tr key={String(row.id)} className="hover:bg-slate-50">
                          {columns.map((key) => <td className="p-3 border-b border-slate-100 max-w-xs" key={key}>{displayValue(row[key], key)}</td>)}
                          <td className="p-3 border-b border-slate-100 whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button onClick={() => setEditingRow(row)} className="btn secondary"><Pencil size={15} />ویرایش</button>
                              {(role === "owner" || role === "admin") && <button type="button" onClick={() => deleteRecord(row)} disabled={busy} className="btn secondary text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} />حذف</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ));
                })() : visibleRows.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-slate-50">
                    {columns.map((key) => <td className="p-3 border-b border-slate-100 max-w-xs" key={key}>{key === "source_url" && row[key] ? <a href={String(row[key])} target="_blank" rel="noreferrer" className="text-blue-700 underline">مشاهده منبع</a> : key === "cases" ? String((row.cases as { title?: string; case_number?: string } | null)?.title ?? "—") + (((row.cases as { case_number?: string } | null)?.case_number) ? " · " + (row.cases as { case_number?: string }).case_number : "") : displayValue(row[key], key)}</td>)}
                    <td className="p-3 border-b border-slate-100 whitespace-nowrap">
                      {module === "documents" ? <button onClick={() => downloadDocument(row)} disabled={busy} className="btn secondary"><Download size={15} />دریافت</button> : module === "project-archive" ? <button type="button" onClick={() => openArchiveConversation(row)} disabled={busy || !row.content_available} className="btn secondary"><Eye size={15} />مشاهده گفتگو</button> : (
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => setEditingRow(row)} className="btn secondary"><Pencil size={15} />ویرایش</button>
                          {module === "clients" && (role === "owner" || role === "admin") && <button type="button" onClick={() => deleteRecord(row)} disabled={busy} className="btn secondary text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} />حذف</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
</tbody>
            </table>
          </div>
        )}
      </section>
      <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} /> اطلاعات هر دفتر با سیاست‌های دسترسی پایگاه داده محدود می‌شود.</div>
    </div>
  );
}