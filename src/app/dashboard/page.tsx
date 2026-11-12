import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Scale, FolderOpen, Users, CalendarClock, FileText, BookOpen, Wallet,
  Settings, ShieldCheck, ArrowUpLeft, MessageCircle
} from "lucide-react";
import { getUserOffice } from "@/lib/supabase/office";

const navigation = [
  { label: "دستیار هوشمند", href: "/dashboard/assistant", icon: MessageCircle },
  { label: "پرونده‌ها", href: "/dashboard/cases", icon: FolderOpen },
  { label: "موکلان", href: "/dashboard/clients", icon: Users },
  { label: "اسناد و مدارک", href: "/dashboard/documents", icon: FileText },
  { label: "مواعد و جلسات", href: "/dashboard/deadlines", icon: CalendarClock },
  { label: "پژوهش حقوقی", href: "/dashboard/research", icon: BookOpen },
  { label: "امور مالی", href: "/dashboard/finance", icon: Wallet },
  { label: "اعضا و تنظیمات", href: "/dashboard/settings", icon: Settings },
];

function formatTehran(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const context = await getUserOffice();
  if (!context.office) redirect("/setup");
  const { supabase, user, office } = context;
  const now = new Date().toISOString();

  const [cases, clients, deadlines, documents, recent] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("office_id", office.id).eq("status", "active"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("office_id", office.id),
    supabase.from("deadlines").select("id", { count: "exact", head: true }).eq("office_id", office.id).eq("status", "open").gte("due_at", now),
    supabase.from("case_documents").select("id", { count: "exact", head: true }).eq("office_id", office.id),
    supabase.from("deadlines").select("id,title,due_at,deadline_type,verification_status").eq("office_id", office.id).eq("status", "open").gte("due_at", now).order("due_at", { ascending: true }).limit(5),
  ]);

  const hasError = [cases.error, clients.error, deadlines.error, documents.error, recent.error].some(Boolean);
  const stats = [
    { label: "پرونده‌های فعال", value: cases.count, note: "پرونده‌های در جریان", href: "/dashboard/cases", icon: FolderOpen },
    { label: "موکلان", value: clients.count, note: "اشخاص و شرکت‌های ثبت‌شده", href: "/dashboard/clients", icon: Users },
    { label: "مواعد پیش‌رو", value: deadlines.count, note: "موعدهای باز از زمان حاضر", href: "/dashboard/deadlines", icon: CalendarClock },
    { label: "اسناد بایگانی‌شده", value: documents.count, note: "فایل‌های خصوصی دفتر", href: "/dashboard/documents", icon: FileText },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">د</div>
          <div><b>دستیار دانیال</b><div className="text-xs text-slate-400 mt-1">مدیریت دفتر وکالت</div></div>
        </div>
        <div className="text-xs text-slate-400 px-3">فضای کاری</div>
        <nav className="nav">
          <Link className="active" href="/dashboard"><Scale size={17} />نمای کلی</Link>
          {navigation.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}><Icon size={17} />{label}</Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-white/10 p-4 text-xs leading-6 text-slate-300">
          اطلاعات پرونده‌ها محرمانه است. دسترسی داده‌ها در پایگاه داده با عضویت و نقش دفتر کنترل می‌شود.
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">فضای خصوصی دفتر وکالت</div>
            <h1>داشبورد مدیریت دفتر</h1>
            <p className="muted text-sm mt-2">{office.name} · {user.email ?? "کاربر احراز هویت‌شده"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="pill"><span className="w-2 h-2 rounded-full bg-emerald-500 ml-2"></span>دسترسی احراز شده</span>
            <form action="/auth/signout" method="post"><button className="btn secondary">خروج</button></form>
          </div>
        </header>

        {hasError && (
          <div className="card mb-5 border-amber-200 text-amber-900 text-sm">
            دریافت بخشی از آمار با خطا مواجه شد. برای جلوگیری از نمایش عدد نادرست، مقدار آن بخش خالی گذاشته شده است.
          </div>
        )}

        <section className="stat-grid">
          {stats.map(({ label, value, note, href, icon: Icon }) => (
            <Link href={href} className="card block" key={label}>
              <div className="flex items-center justify-between">
                <div className="stat-label">{label}</div>
                <div className="feature-icon"><Icon size={19} /></div>
              </div>
              <div className="stat-value tabular-nums">{value ?? "—"}</div>
              <div className="text-xs text-slate-400 mt-2">{note}</div>
            </Link>
          ))}
        </section>

        <div className="section-head"><h2>ماژول‌های سامانه</h2><span className="pill">متصل به پایگاه داده دفتر</span></div>
        <section className="feature-grid">
          {navigation.map(({ label, href, icon: Icon }) => (
            <Link href={href} className="card feature" key={href}>
              <div className="feature-icon"><Icon size={19} /></div>
              <div><h3 className="font-bold text-sm">{label}</h3><p className="text-xs leading-6 text-slate-500 mt-2">مشاهده و مدیریت اطلاعات ثبت‌شده در فضای خصوصی دفتر.</p></div>
              <ArrowUpLeft size={15} className="mr-auto text-slate-400" />
            </Link>
          ))}
        </section>

        <section className="card mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="feature-icon"><CalendarClock size={19} /></div>
            <div><h2 className="font-bold text-sm">نزدیک‌ترین مواعد باز</h2><p className="text-xs text-slate-500 mt-1">زمان‌ها بر مبنای منطقه زمانی تهران نمایش داده می‌شوند.</p></div>
          </div>
          {recent.data?.length ? (
            <div className="divide-y divide-slate-100">
              {recent.data.map((item) => (
                <div key={item.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span>{item.title}</span>
                  <span className="text-slate-500">{formatTehran(item.due_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-3">{recent.error ? "دریافت مواعد ممکن نشد." : "موعد بازِ پیش‌رو ثبت نشده است."}</p>
          )}
        </section>

        <section className="card mt-6">
          <div className="flex items-center gap-3">
            <div className="feature-icon"><ShieldCheck size={19} /></div>
            <div>
              <h2 className="font-bold text-sm">وضعیت محرمانگی</h2>
              <p className="text-xs text-slate-500 mt-1 leading-6">
                فایل‌ها در مخزن خصوصی نگهداری می‌شوند و داده‌های هر دفتر با سیاست‌های RLS و شناسه دفتر محدود شده‌اند.
              </p>
            </div>
          </div>
        </section>
        <footer className="text-xs text-slate-400 mt-8">دستیار جامع اختصاصی دانیال · نسخه وب خصوصی</footer>
      </main>
    </div>
  );
}
