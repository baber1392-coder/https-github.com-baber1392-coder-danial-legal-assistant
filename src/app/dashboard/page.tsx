import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Scale, FolderOpen, Users, CalendarClock, FileText, Search, Wallet, Settings, ShieldCheck, BookOpen, Bell, Menu, ArrowUpLeft } from "lucide-react";

const navigation=[["نمای کلی", "/dashboard", Scale],["پرونده‌ها","/dashboard/cases",FolderOpen],["موکلان","/dashboard/clients",Users],["اسناد و مدارک","/dashboard/documents",FileText],["مواعد و جلسات","/dashboard/deadlines",CalendarClock],["پژوهش حقوقی","/dashboard/research",BookOpen],["امور مالی","/dashboard/finance",Wallet],["تنظیمات","/dashboard/settings",Settings]] as const;
const features=[
  {title:"مدیریت پرونده‌ها",desc:"ثبت مشخصات، طرفین، شعبه، شماره پرونده و شماره بایگانی.",icon:FolderOpen},
  {title:"بایگانی اسناد",desc:"طبقه‌بندی قراردادها، دادخواست‌ها، لوایح و مستندات هر پرونده.",icon:FileText},
  {title:"تقویم و مواعد",desc:"پیگیری جلسات، مهلت‌ها و اقدامات بعدی هر پرونده.",icon:CalendarClock},
  {title:"پژوهش حقوقی",desc:"سامان‌دهی قوانین، آرای وحدت رویه و آرای مشابه با ذکر منبع.",icon:BookOpen},
  {title:"دستیار نگارش",desc:"تهیه پیش‌نویس لوایح و متون قضایی با قابلیت بازبینی.",icon:Scale},
  {title:"امنیت و سوابق",desc:"کنترل نقش‌ها، تفکیک دسترسی و ثبت رویدادهای مهم.",icon:ShieldCheck}
];
export default async function DashboardPage(){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">د</div><div><b>دستیار دانیال</b><div className="text-xs text-slate-400 mt-1">مدیریت هوشمند دفتر</div></div></div>
      <div className="text-xs text-slate-400 px-3">فضای کاری</div><nav className="nav">{navigation.map(([label,href,Icon],i)=><Link className={i===0?"active":""} href={href} key={href}><Icon size={17}/>{label}</Link>)}</nav>
      <div className="mt-auto rounded-xl bg-white/10 p-4 text-xs leading-6 text-slate-300">اطلاعات پرونده‌ها محرمانه است. دسترسی هر کاربر باید بر اساس عضویت و نقش او کنترل شود.</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">فضای خصوصی دفتر وکالت</div><h1>داشبورد مدیریت دفتر</h1><p className="muted text-sm mt-2">خوش آمدید. نمای کلی ابزارهای کاری شما در این بخش قرار دارد.</p></div>
        <div className="flex items-center gap-3"><span className="pill"><span className="w-2 h-2 rounded-full bg-emerald-500 ml-2"></span>حساب احراز هویت شده</span><form action="/auth/signout" method="post"><button className="btn secondary">خروج</button></form></div>
      </header>
      <section className="stat-grid">
        {[["پرونده‌های فعال","—","نیازمند اتصال پایگاه داده"],["موکلان","—","نیازمند اتصال پایگاه داده"],["مواعد پیش‌رو","—","نیازمند اتصال پایگاه داده"],["اسناد بایگانی‌شده","—","نیازمند اتصال پایگاه داده"]].map(([label,value,note])=><div className="card" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="text-xs text-slate-400 mt-2">{note}</div></div>)}
      </section>
      <div className="section-head"><h2>ماژول‌های سامانه</h2><span className="pill">نسخه پایه در حال راه‌اندازی</span></div>
      <section className="feature-grid">{features.map(({title,desc,icon:Icon})=><article className="card feature" key={title}><div className="feature-icon"><Icon size={19}/></div><div><h3 className="font-bold text-sm">{title}</h3><p className="text-xs leading-6 text-slate-500 mt-2">{desc}</p></div></article>)}</section>
      <section className="card mt-6"><div className="flex items-center gap-3"><div className="feature-icon"><ShieldCheck size={19}/></div><div><h2 className="font-bold text-sm">وضعیت اتصال داده‌ها</h2><p className="text-xs text-slate-500 mt-1">احراز هویت آماده پیکربندی است؛ اتصال عملیاتی پایگاه داده تا فعال‌سازی و بررسی پروژه Supabase تکمیل نمی‌شود.</p></div></div></section>
      <footer className="text-xs text-slate-400 mt-8">دستیار جامع اختصاصی دانیال · محیط محرمانه مدیریت دفتر</footer>
    </main>
  </div>;
}