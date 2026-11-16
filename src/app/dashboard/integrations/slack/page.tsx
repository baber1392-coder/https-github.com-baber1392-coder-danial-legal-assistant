import { requireOffice } from "@/lib/supabase/office";
import SlackIntegration from "@/components/integrations/SlackIntegration";

export const dynamic = "force-dynamic";

export default async function SlackIntegrationPage() {
  await requireOffice();
  return <SlackIntegration />;
}
