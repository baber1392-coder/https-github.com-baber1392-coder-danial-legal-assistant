import { redirect } from "next/navigation";
import { getUserOffice } from "@/lib/supabase/office";
import NoticeIntake from "@/components/notifications/NoticeIntake";

export default async function NotificationsPage() {
  const context = await getUserOffice();
  if (!context.office) redirect("/setup");
  const { data: cases, error } = await context.supabase
    .from("cases")
    .select("id,title,case_number,archive_number")
    .eq("office_id", context.office.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("دریافت فهرست پرونده‌ها ممکن نشد.");

  return <NoticeIntake officeId={context.office.id} cases={cases ?? []} />;
}
