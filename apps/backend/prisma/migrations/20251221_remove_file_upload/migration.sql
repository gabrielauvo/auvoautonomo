-- Remove FILE_UPLOAD question type
-- This migration:
-- 1. Converts all FILE_UPLOAD questions to PHOTO_OPTIONAL
-- 2. Converts all FILE_UPLOAD answers to PHOTO_OPTIONAL
-- 3. Removes FILE_UPLOAD from the enum

-- Step 1: Convert questions with FILE_UPLOAD to PHOTO_OPTIONAL
UPDATE checklist_questions
SET type = 'PHOTO_OPTIONAL'
WHERE type = 'FILE_UPLOAD';

-- Step 2: Convert answers with FILE_UPLOAD to PHOTO_OPTIONAL
UPDATE checklist_answers
SET type = 'PHOTO_OPTIONAL'
WHERE type = 'FILE_UPLOAD';

-- Step 3: Update templateVersionSnapshot in checklist_instances (JSON field)
-- This updates the questions array inside the JSON to change FILE_UPLOAD to PHOTO_OPTIONAL
UPDATE checklist_instances
SET template_version_snapshot =
  REPLACE(template_version_snapshot::text, '"FILE_UPLOAD"', '"PHOTO_OPTIONAL"')::jsonb
WHERE template_version_snapshot::text LIKE '%FILE_UPLOAD%';

-- Step 4: Update work_order_checklist_answers if any use FILE_UPLOAD
UPDATE work_order_checklist_answers
SET type = 'PHOTO'
WHERE type::text = 'FILE_UPLOAD';

-- Note: The enum value removal will be done via Prisma schema update
-- after ensuring no data uses FILE_UPLOAD anymore
