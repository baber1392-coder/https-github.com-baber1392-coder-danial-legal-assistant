"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    createClient().auth.getUser().then(({ data }) => {
      if (active) {
        setReady(Boolean(data.user));
        if (!data.user) setMessage("نشست بازیابی معتبر نیست یا منقضی شده است. دوباره درخواست بازیابی ثبت کنید.");
      }
    }).catch(() => {
      if (active) setMessage("بررسی نشست بازیابی انجام نشد. دوباره از صفحه بازیابی اقدام کنید.");
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) {
      setMessage("گذرواژه باید دست‌کم ۱۲ نویسه داشته باشد.");
      return;
    }
    if (password !== confirm) {
      setMessage("تکرار گذرواژه با مقدار نخست یکسان نیست.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw new Error(error.message);
      setMessage("گذرواژه تغییر کرد.");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تغییر گذرواژه انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-5 bg-slate-50">
      <section className="card w-full max-w-md">
        <div className="brand-mark mb-5">د</div>
        <div className="eyebrow">امنیت حساب</div>
        <h1 className="mt-2">تعیین گذرواژه جدید</h1>
        {!ready ? (
          <p className="text-sm leading-7 text-slate-600 mt-5">{message || "در حال بررسی پیوند بازیابی..."}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-5">
            <label className="field-label">گذرواژه جدید
              <input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="field-input" dir="ltr" />
            </label>
            <label className="field-label">تکرار گذرواژه
              <input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="field-input" dir="ltr" />
            </label>
            <p className="text-xs text-slate-500">برای حفاظت بهتر، دست‌کم ۱۲ نویسه و ترکیبی از حروف و اعداد انتخاب کنید.</p>
            {message && <p role="status" className="text-sm leading-7 text-slate-700">{message}</p>}
            <button disabled={busy} className="btn w-full">{busy ? "در حال ذخیره..." : "ذخیره گذرواژه جدید"}</button>
          </form>
        )}
        <Link href="/login" className="block text-sm text-center mt-5 text-slate-600 underline">بازگشت به ورود</Link>
      </section>
    </main>
  );
}
