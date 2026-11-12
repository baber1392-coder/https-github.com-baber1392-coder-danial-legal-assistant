# Supabase migration inventory

Project: `jwhyeohqolabcbuwhfon`

This inventory records migrations confirmed in the live Supabase migration history on 2026-11-12. It is **not** a replayable migration set: the original SQL bodies for these already-applied migrations were not present in the connected repository when inspected. Do not recreate or re-run them from their names alone.

| Version | Migration |
|---|---|
| 20261109032351 | create_secure_user_profiles |
| 20261111132356 | create_private_legal_office_core |
| 20261111132700 | preserve_office_scope_on_related_record_delete |
| 20261111135840 | allow_uploader_rollback_for_private_documents |
| 20261111140528 | index_foreign_keys_and_split_write_rls_policies |
| 20261111140928 | record_deadline_timezone_and_lock_actor_fields |
| 20261112073242 | repair_postgrest_exposed_schemas |
| 20261112104605 | add_private_ai_assistant_chat |
| 20261112141329 | case_document_ai_access_sms_and_invites |
| 20261112141543 | secure_office_invitation_code_functions |
| 20261112141920 | fix_invitation_redeem_active_member_guard |

## Verified live state at inventory time

- 27 case records.
- 0 case document metadata records.
- 0 extracted document chunks.
- 0 explicit assistant-access rows.
- 0 invitation codes.
- 0 SMS queue rows and 0 SMS provider settings rows.
- One Storage bucket, `case-documents`, with private object policies.
- RLS enabled on the inspected public tables.

## Operational cautions

1. Existing Library files in ChatGPT have not been copied into Supabase Storage by this inventory.
2. The current web upload path extracts plain text only; PDF, DOCX and image OCR still need a parser/OCR worker.
3. The web assistant requires a configured model provider key in Render. ChatGPT subscription access does not supply an API key.
4. SMS delivery requires an Iranian SMS provider account, sender number, credentials and a worker/scheduler.
5. The separate ChatGPT assistant/plugin has not yet been verified as authenticated against the shared case API.
6. Keep future SQL migrations as timestamped files in this directory and apply them through the normal migration workflow. Never mark a migration as applied solely by editing this file.
