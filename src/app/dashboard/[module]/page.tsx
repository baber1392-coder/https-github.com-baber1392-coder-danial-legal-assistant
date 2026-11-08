import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, FolderOpen, Users, FileText, CalendarClock, BookOpen, Wallet, Settings } from "lucide-react";

const modules: Record<string,{title:string;description:string;icon:typeof FolderOpen;items:string[]}> = {
  cases:{title:"مدیریت پرونده‌ها",description:"ثبت و پیگیری پرونده‌های حقوقی و کیفری با تفکیک شماره پرونده و شماره بایگانی.",icon:FolderOpen,items:["مشخصات پرونده و مرجع رسیدگی","طرفین و سمت اشخاص","وضعیت دادرسی و اقدامات بعدی","ارتباط اسناد و مواعد با پرونده"]},
  clients:{title:"مدیریت موکلان",description:"سامان‌دهی اطلاعات موکلان و ارتباط آن‌ها با پرونده‌های مربوط.",icon:Users,items:["پروفایل موکل و اطلاعات تماس","پرونده‌های مرتبط","سوابق قرارداد وکالت","کنترل دسترسی به اطلاعات شخصی"]},
  documents:{title:"اسناد و مدارک",description:"بایگانی طبقه‌بندی‌شده اسناد و مستندات در فضای خصوصی دفتر.",icon:FileText,items:["دسته‌بندی اسناد","اتصال هر سند به پرونده","نسخه‌بندی و تاریخچه تغییرات","سیاست دسترسی امن Storage"]},
  deadlines:{title:"مواعد و جلسات",description:"تقویم جلسات، مهلت‌ها و اقدامات آتی با قابلیت پیوند به پرونده.",icon:CalendarClock,items:["ثبت جلسه و مهلت","تعیین مسئول پیگیری","اولویت و وضعیت انجام","ثبت منبع و مبنای محاسبه مهلت"]},
  research:{title:"پژوهش حقوقی",description:"سامان‌دهی منابع حقوقی و ثبت استنادات قابل راستی‌آزمایی.",icon:BookOpen,items:["قوانین و مقررات","آرای وحدت رویه و آرای مشابه","نظریات مشورتی","ثبت منبع، تاریخ بازیابی و وضعیت اعتبارسنجی"]},
  finance:{title:"امور مالی",description:"ثبت و تطبیق دریافتی‌ها، هزینه‌ها و مطالبات دفتر.",icon:Wallet,items:["دریافت و پرداخت","قرارداد و حق‌الوکاله","مانده حساب پرونده","گزارش‌های مالی قابل بازبینی"]},
  settings:{title:"تنظیمات و دسترسی‌ها",description:"مدیریت اعضا، نقش‌ها و تنظیمات امنیتی محیط کاری.",icon:Settings,items:["مدیریت اعضای دفتر","نقش‌ها و مجوزها","سوابق رویدادهای امنیتی","تنظیمات اتصال و اعلان‌ها"]}
};
export default async function ModulePage({params}:{params:Promise<{module:string}>}){
 const {module}=await params; const item=modules[module]; if(!item) notFound();
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const Icon=item.icon;
 return <main className="main max-w-5xl mx-auto">
   <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 mb-8"><ArrowRight size={16}/> بازگشت به داشبورد</Link>
   <div className="card mb-5"><div className="feature-icon mb-4"><Icon size={22}/></div><div className="eyebrow">ماژول مدیریت دفتر</div><h1 className="mt-2">{item.title}</h1><p className="muted text-sm leading-7 mt-3">{item.description}</p></div>
   <section className="card"><h2 className="font-bold mb-5">قابلیت‌های پیش‌بینی‌شده</h2><ul className="grid md:grid-cols-2 gap-4">{item.items.map(text=><li key={text} className="flex items-center gap-3 text-sm"><span className="w-2 h-2 rounded-full bg-[#c5a46d]"/>{text}</li>)}</ul><div className="mt-7 rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900 leading-7">این بخش در نسخه پایه ایجاد شده است. اتصال عملیات ثبت و بازیابی اطلاعات پس از فعال‌سازی و بررسی schema پروژه اصلی Supabase تکمیل خواهد شد؛ در حال حاضر داده‌ای به‌صورت ساختگی نمایش داده یا ذخیره نمی‌شود.</div></section>
 </main>;
}