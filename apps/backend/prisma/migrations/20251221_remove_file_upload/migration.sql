-- Remove FILE_UPLOAD question type
-- This migration:
-- 1. Converts all FILE_UPLOAD questions to PHOTO_OPTIONAL
-- 2. Converts all FILE_UPLOAD answers to PHOTO_OPTIONAL
-- 3. Removes FILE_UPLOAD from the enum

-- Step 1: Convert questions with FILE_UPLOAD to PHOTO_OPTIONAL (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checklist_questions') THEN
    UPDATE checklist_questions SET type = 'PHOTO_OPTIONAL' WHERE type = 'FILE_UPLOAD';
  END IF;
END $$;

-- Step 2: Convert answers with FILE_UPLOAD to PHOTO_OPTIONAL (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checklist_answers') THEN
    UPDATE checklist_answers SET type = 'PHOTO_OPTIONAL' WHERE type = 'FILE_UPLOAD';
  END IF;
END $$;

-- Step 3: Update templateVersionSnapshot in checklist_instances (JSON field)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checklist_instances') THEN
    UPDATE checklist_instances
    SET template_version_snapshot = REPLACE(template_version_snapshot::text, '"FILE_UPLOAD"', '"PHOTO_OPTIONAL"')::jsonb
    WHERE template_version_snapshot::text LIKE '%FILE_UPLOAD%';
  END IF;
END $$;

-- Step 4: Update work_order_checklist_answers if any use FILE_UPLOAD (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'work_order_checklist_answers') THEN
    UPDATE work_order_checklist_answers SET type = 'PHOTO' WHERE type::text = 'FILE_UPLOAD';
  END IF;
END $$;
