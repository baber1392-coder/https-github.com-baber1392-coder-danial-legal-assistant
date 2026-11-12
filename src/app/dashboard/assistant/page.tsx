import { requireOffice } from "@/lib/supabase/office";
import AssistantChat from "@/components/assistant/AssistantChat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireOffice();
  return <AssistantChat />;
}
