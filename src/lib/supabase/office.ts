import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return { supabase, user: data.user };
}

export async function getUserOffice() {
  const { supabase, user } = await requireUser();

  const { data: membership, error: membershipError } = await supabase
    .from("office_memberships")
    .select("office_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error("امکان بررسی عضویت دفتر وجود ندارد.");
  }

  if (!membership) {
    return { supabase, user, office: null, role: null as string | null };
  }

  const { data: office, error: officeError } = await supabase
    .from("offices")
    .select("id, name")
    .eq("id", membership.office_id)
    .single();

  if (officeError || !office) {
    throw new Error("دفتر فعال کاربر قابل بازیابی نیست.");
  }

  return { supabase, user, office, role: membership.role as string };
}

export async function requireOffice() {
  const context = await getUserOffice();
  if (!context.office) {
    redirect("/setup");
  }
  return {
    ...context,
    office: context.office,
  };
}
