"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const redirectTo = window.location.origin + "/auth/callback?next=/update-password";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw new Error(error.message);
      setMessage("درخواست ثبت شد. در صورت وجود حساب با این نشانی، پیوند بازیابی ارسال می‌شود.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ارسال درخواست بازیابی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen grid place-items-center p-5 bg-slate-50">
      <section className="card w-full max-w-md">
        <div className="brand-mark mb-5">د</div>
        <div className="eyebrow">بازیابی دسترسی</div>
        <h1 className="mt-2">بازیابی گذرواژه</h1>
        <p className="muted text-sm leading-7 mt-3 mb-6">نشانی ایمیل حساب خود را وارد کنید تا پیوند امن بازیابی ارسال شود.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="field-label">ایمیل
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" dir="ltr" />
          </label>
          {message && <p role="status" className="text-sm leading-7 text-slate-700">{message}</p>}
          <button disabled={busy} className="btn w-full">{busy ? "در حال ارسال..." : "ارسال پیوند بازیابی"}</button>
        </form>
        <Link href="/login" className="block text-sm text-center mt-5 text-slate-600 underline">بازگشت به ورود</Link>
      </section>
    </main>
  );
}
