-- This migration removes the old lawyer_assigned column
-- It should be run after all code has been updated to use case_lawyers table

-- Drop foreign key if exists (ignore error if not exists)
ALTER TABLE cases DROP FOREIGN KEY cases_ibfk_1;

-- Drop the column if exists (ignore error if not exists)
ALTER TABLE cases DROP COLUMN lawyer_assigned;