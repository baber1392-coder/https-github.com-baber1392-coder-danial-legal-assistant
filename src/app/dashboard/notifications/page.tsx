import { redirect } from "next/navigation";
import { getUserOffice } from "@/lib/supabase/office";
import NoticeIntake from "@/components/notifications/NoticeIntake";

export default async function NotificationsPage() {
  const context = await getUserOffice();
  if (!context.office) redirect("/setup");

  const officeId = context.office.id;
  const [caseResult, noticeResult, deadlineResult] = await Promise.all([
    context.supabase
      .from("cases")
      .select("id,title,case_number,archive_number")
      .eq("office_id", officeId)
      .order("created_at", { ascending: false }),
    context.supabase
      .from("case_documents")
      .select("id,case_id,original_filename,content_type,size_bytes,created_at,extraction_status,extracted_text,source_label")
      .eq("office_id", officeId)
      .eq("document_type", "notice")
      .order("created_at", { ascending: false })
      .limit(50),
    context.supabase
      .from("deadlines")
      .select("id,case_id,title,deadline_type,due_at,status,verification_status,source")
      .eq("office_id", officeId)
      .eq("status", "open")
      .order("due_at", { ascending: true })
      .limit(50),
  ]);

  if (caseResult.error || noticeResult.error || deadlineResult.error) {
    throw new Error("دریافت فهرست ابلاغیه‌ها یا موعدهای دفتر ممکن نشد.");
  }

  return (
    <NoticeIntake
      officeId={officeId}
      cases={caseResult.data ?? []}
      notices={noticeResult.data ?? []}
      deadlines={deadlineResult.data ?? []}
    />
  );
}
