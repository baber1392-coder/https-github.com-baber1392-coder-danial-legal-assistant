"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const rawIdentifier = identifier.normalize("NFC").trim();
      let loginEmail = rawIdentifier;
      if (!rawIdentifier.includes("@")) {
        const canonical = rawIdentifier.replace(/[\\s\\u200c\\u200d]+/g, "");
        const bytes = new TextEncoder().encode(canonical);
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        loginEmail = `u-${hex}@members.danial-legal.app`;
      }
      const { error: signInError } = await createClient().auth.signInWithPassword({ email: loginEmail, password });
      if (signInError) throw new Error("ورود انجام نشد. ایمیل و گذرواژه را بررسی کنید.");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-white">
      <section className="hidden lg:flex bg-[#10243a] text-white p-16 flex-col justify-between">
        <div className="flex items-center gap-3"><div className="brand-mark">د</div><b>دستیار جامع اختصاصی دانیال</b></div>
        <div>
          <p className="text-[#c5a46d] mb-3">سامانه مدیریت دفتر وکالت</p>
          <h1 className="text-4xl leading-[1.7] font-bold">نظم در پرونده‌ها،<br />دقت در پژوهش،<br />امنیت در اطلاعات.</h1>
          <p className="text-slate-300 mt-5 leading-8">محیط کاری خصوصی برای مدیریت پرونده‌ها و گردش‌کار حقوقی.</p>
        </div>
        <p className="text-xs text-slate-400">دسترسی صرفاً برای کاربران مجاز دفتر</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-[#f4efe5] text-[#9a7a45] grid place-items-center mb-7"><Scale size={27} /></div>
          <p className="text-sm text-[#9a7a45] font-bold">ورود امن</p>
          <h2 className="text-2xl font-bold mt-2">به فضای کاری دانیال خوش آمدید</h2>
          <p className="text-sm text-slate-500 mt-3 mb-8">برای ادامه، اطلاعات حساب کاربری خود را وارد کنید.</p>
          <label className="block text-sm mb-2">نام کاربری یا ایمیل</label>
          <input type="text" required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="w-full border border-slate-200 rounded-xl p-3 mb-5 outline-none focus:border-[#9a7a45]" dir="auto" />
          <label className="block text-sm mb-2">گذرواژه</label>
          <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border border-slate-200 rounded-xl p-3 mb-3 outline-none focus:border-[#9a7a45]" dir="ltr" />
          <div className="flex justify-end mb-5"><Link href="/reset-password" className="text-xs text-[#8a6e42] underline">گذرواژه را فراموش کرده‌ام</Link></div>
          {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}
          <button disabled={loading} className="w-full bg-[#10243a] text-white rounded-xl p-3 disabled:opacity-60">{loading ? "در حال ورود..." : "ورود به سامانه"}</button>
          <p className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-7"><ShieldCheck size={15} /> کنترل دسترسی بر اساس حساب و عضویت دفتر</p>
        </form>
      </section>
    </main>
  );
}
