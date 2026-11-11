import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/office";
import SetupForm from "./setup-form";

export default async function SetupPage() {
  const { supabase, user } = await requireUser();
  const { data: membership, error } = await supabase
    .from("office_memberships").select("office_id")
    .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();

  if (error) throw new Error("بررسی عضویت دفتر انجام نشد.");
  if (membership) redirect("/dashboard");

  return (
    <main className="min-h-screen grid place-items-center p-5 bg-slate-50">
      <section className="card w-full max-w-xl">
        <div className="brand-mark mb-5">د</div>
        <div className="eyebrow">راه‌اندازی اولیه</div>
        <h1 className="mt-2">ایجاد فضای کاری دفتر</h1>
        <p className="text-sm leading-7 text-slate-600 mt-4 mb-6">
          این مرحله فقط برای کاربری است که هنوز عضو هیچ دفتر فعالی نیست. نام دفتر و عضویت مالک به‌صورت اتمیک در پایگاه داده ثبت می‌شود.
        </p>
        <SetupForm />
      </section>
    </main>
  );
}
