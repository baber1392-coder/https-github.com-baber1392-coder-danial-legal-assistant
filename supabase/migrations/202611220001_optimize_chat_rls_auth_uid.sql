-- Danial Legal Assistant 3.0
-- Performance-only RLS expression optimization.
-- Preserves every existing predicate and role boundary; does not widen access.
-- Review and apply through a controlled Supabase migration after staging tests.

ALTER POLICY ai_chat_conversations_delete_own
ON public.ai_chat_conversations
USING (
  created_by = (SELECT auth.uid())
  AND (SELECT private.has_office_role(
    ai_chat_conversations.office_id,
    ARRAY['owner', 'admin', 'lawyer', 'staff']::text[]
  ))
);

ALTER POLICY ai_chat_conversations_insert_own
ON public.ai_chat_conversations
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (SELECT private.has_office_role(
    ai_chat_conversations.office_id,
    ARRAY['owner', 'admin', 'lawyer', 'staff']::text[]
  ))
);

ALTER POLICY ai_chat_conversations_select_own
ON public.ai_chat_conversations
USING (
  created_by = (SELECT auth.uid())
  AND (SELECT private.is_office_member(ai_chat_conversations.office_id))
);

ALTER POLICY ai_chat_conversations_update_own
ON public.ai_chat_conversations
USING (
  created_by = (SELECT auth.uid())
  AND (SELECT private.has_office_role(
    ai_chat_conversations.office_id,
    ARRAY['owner', 'admin', 'lawyer', 'staff']::text[]
  ))
)
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (SELECT private.has_office_role(
    ai_chat_conversations.office_id,
    ARRAY['owner', 'admin', 'lawyer', 'staff']::text[]
  ))
);

ALTER POLICY ai_chat_messages_delete_own
ON public.ai_chat_messages
USING (
  created_by = (SELECT auth.uid())
  AND (SELECT private.has_office_role(
    ai_chat_messages.office_id,
    ARRAY['owner', 'admin', 'lawyer', 'staff']::text[]
  ))
);

ALTER POLICY ai_chat_messages_insert_own
ON public.ai_chat_messages
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (SELECT private.has_office_role(
    ai_chat_messages.office_id,
    ARRAY['owner', 'admin', 'lawyer', 'staff']::text[]
  ))
  AND EXISTS (
    SELECT 1
    FROM public.ai_chat_conversations AS c
    WHERE c.id = ai_chat_messages.conversation_id
      AND c.office_id = ai_chat_messages.office_id
      AND c.created_by = (SELECT auth.uid())
  )
);

ALTER POLICY ai_chat_messages_select_own
ON public.ai_chat_messages
USING (
  created_by = (SELECT auth.uid())
  AND (SELECT private.is_office_member(ai_chat_messages.office_id))
);
