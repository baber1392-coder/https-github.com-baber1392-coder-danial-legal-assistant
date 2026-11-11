"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetupForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("create_office_for_current_user", { p_name: name.trim() });
      if (error) throw new Error(error.message);
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ایجاد فضای کاری انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="field-label">نام دفتر
        <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="field-input" placeholder="برای مثال: دفتر وکالت دانیال رحیمی" />
      </label>
      {message && <p className="text-sm text-red-700" role="alert">{message}</p>}
      <button disabled={busy} className="btn w-full">{busy ? "در حال ثبت..." : "ایجاد دفتر و ادامه"}</button>
    </form>
  );
}
