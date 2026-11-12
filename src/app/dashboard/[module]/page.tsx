import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireOffice } from "@/lib/supabase/office";
import ModuleClient from "./module-client";

const modules: Record<string, { title: string; description: string; table: string; order: string; ascending?: boolean }> = {
  cases: { title: "مدیریت پرونده‌ها", description: "ثبت شماره پرونده و بایگانی، مرجع رسیدگی، موضوع و وضعیت پرونده.", table: "cases", order: "updated_at" },
  clients: { title: "مدیریت موکلان", description: "ثبت و نگهداری اطلاعات اشخاص و شرکت‌های مرتبط با دفتر.", table: "clients", order: "created_at" },
  documents: { title: "اسناد و مدارک", description: "بارگذاری و دریافت امن اسناد در مخزن خصوصی دفتر.", table: "case_documents", order: "created_at" },
  deadlines: { title: "مواعد و جلسات", description: "ثبت مهلت‌ها با مبنای قانونی، منبع و وضعیت راستی‌آزمایی.", table: "deadlines", order: "due_at", ascending: true },
  research: { title: "پژوهش حقوقی", description: "ثبت قوانین، آرای وحدت رویه، نظریات مشورتی و آرای مشابه همراه با منبع.", table: "legal_research", order: "created_at" },
  finance: { title: "امور مالی", description: "ثبت دریافت‌ها، هزینه‌ها و سایر گردش‌های مالی دفتر به ریال یا تومان.", table: "financial_records", order: "occurred_at" },
  settings: { title: "اعضا و تنظیمات", description: "مشاهده اعضای فعال و نقش‌های ثبت‌شده در دفتر.", table: "office_memberships", order: "created_at" },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const config = modules[module];
  if (!config) notFound();

  const { supabase, user, office, role } = await requireOffice();
  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .eq("office_id", office.id)
    .order(config.order, { ascending: config.ascending ?? false })
    .limit(100);

  if (error) {
    throw new Error("دریافت اطلاعات این بخش انجام نشد. دسترسی دفتر و وضعیت پایگاه داده را بررسی کنید.");
  }

  let caseOptions: { id: string; title: string }[] = [];
  if (module === "documents" || module === "deadlines") {
    const { data: cases } = await supabase.from("cases").select("id,title").eq("office_id", office.id).order("created_at", { ascending: false }).limit(500);
    caseOptions = cases ?? [];
  }

  let rows = (data ?? []) as Record<string, unknown>[];
  if (module === "documents") {
    const { data: caseRows } = await supabase.from("cases").select("id,title,case_number").eq("office_id", office.id);
    const caseMap = new Map((caseRows ?? []).map((item) => [item.id, item]));
    rows = rows.map((row) => ({ ...row, cases: caseMap.get(String(row.case_id)) ?? null }));
  }

  return (
    <main className="main max-w-6xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 mb-6"><ArrowRight size={16} /> بازگشت به داشبورد</Link>
      <div className="card mb-5">
        <div className="eyebrow">دفتر: {office.name}</div>
        <h1 className="mt-2">{config.title}</h1>
        <p className="muted text-sm leading-7 mt-3">{config.description}</p>
      </div>
      <ModuleClient
        module={module}
        title={config.title}
        rows={rows}
        officeId={office.id}
        userId={user.id}
        role={role}
        caseOptions={caseOptions}
      />
    </main>
  );
}
