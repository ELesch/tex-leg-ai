-- Migration: Move all tables to texlegai schema
-- Run this SQL manually in Supabase SQL Editor BEFORE deploying the schema changes
-- This preserves all existing data
--
-- IMPORTANT: Run this migration in order:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Deploy the updated code (or run `npm run db:push` locally)

-- ============================================
-- Step 1: Create the texlegai schema
-- ============================================
CREATE SCHEMA IF NOT EXISTS texlegai;

-- ============================================
-- Step 2: Rename saved_bill to followed_bill (if exists)
-- ============================================
ALTER TABLE IF EXISTS public.saved_bill RENAME TO followed_bill;

-- ============================================
-- Step 3: Move all tables from public to texlegai schema
-- ============================================

-- User & Authentication tables
ALTER TABLE IF EXISTS public."User" SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public."Account" SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public."Session" SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public."VerificationToken" SET SCHEMA texlegai;

-- Legislature tables
ALTER TABLE IF EXISTS public.legislature_session SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public."Bill" SET SCHEMA texlegai;

-- Bill structure tables
ALTER TABLE IF EXISTS public.bill_article SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.bill_code_reference SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.terminology_replacement SET SCHEMA texlegai;

-- Chat tables
ALTER TABLE IF EXISTS public.chat_session SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.chat_message SET SCHEMA texlegai;

-- Followed bills
ALTER TABLE IF EXISTS public.followed_bill SET SCHEMA texlegai;

-- Admin settings
ALTER TABLE IF EXISTS public.admin_setting SET SCHEMA texlegai;

-- Team collaboration tables
ALTER TABLE IF EXISTS public.team SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.team_membership SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.team_invitation SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.team_workspace SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.bill_annotation SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.workspace_comment SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.team_chat_session SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.team_chat_message SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.team_activity SET SCHEMA texlegai;

-- Personal annotations & notes
ALTER TABLE IF EXISTS public.personal_annotation SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.personal_note SET SCHEMA texlegai;

-- Contacts management tables
ALTER TABLE IF EXISTS public.author SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.contact SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.staff_position SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.user_contact SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.contact_note SET SCHEMA texlegai;
ALTER TABLE IF EXISTS public.shared_contact SET SCHEMA texlegai;

-- Sync job
ALTER TABLE IF EXISTS public.sync_job SET SCHEMA texlegai;

-- ============================================
-- Step 4: Move enum types to texlegai schema
-- ============================================
-- PostgreSQL enums ARE schema-scoped. Move them to texlegai.
-- Note: IF EXISTS not supported with SET SCHEMA, but these enums must exist.
ALTER TYPE public."UserRole" SET SCHEMA texlegai;
ALTER TYPE public."BillType" SET SCHEMA texlegai;
ALTER TYPE public."BillComplexity" SET SCHEMA texlegai;
ALTER TYPE public."BillPattern" SET SCHEMA texlegai;
ALTER TYPE public."CodeReferenceAction" SET SCHEMA texlegai;
ALTER TYPE public."MessageRole" SET SCHEMA texlegai;
ALTER TYPE public."SettingType" SET SCHEMA texlegai;
ALTER TYPE public."TeamRole" SET SCHEMA texlegai;
ALTER TYPE public."WorkspaceStatus" SET SCHEMA texlegai;
ALTER TYPE public."WorkspacePriority" SET SCHEMA texlegai;
ALTER TYPE public."AnnotationType" SET SCHEMA texlegai;
ALTER TYPE public."NoteSourceType" SET SCHEMA texlegai;
ALTER TYPE public."ActivityType" SET SCHEMA texlegai;
ALTER TYPE public."Chamber" SET SCHEMA texlegai;
ALTER TYPE public."StaffRole" SET SCHEMA texlegai;
ALTER TYPE public."SyncJobStatus" SET SCHEMA texlegai;

-- ============================================
-- Step 5: Grant permissions
-- ============================================
-- This ensures Supabase roles can access the new schema
GRANT USAGE ON SCHEMA texlegai TO authenticated;
GRANT USAGE ON SCHEMA texlegai TO anon;
GRANT USAGE ON SCHEMA texlegai TO service_role;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA texlegai TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA texlegai TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA texlegai TO anon;

-- Grant sequence permissions (for auto-increment)
GRANT ALL ON ALL SEQUENCES IN SCHEMA texlegai TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA texlegai TO service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA texlegai GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA texlegai GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA texlegai GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA texlegai GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA texlegai GRANT ALL ON SEQUENCES TO service_role;

-- ============================================
-- Verification (run after migration)
-- ============================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'texlegai';
-- Should list all your tables

-- ============================================
-- After this migration:
-- ============================================
-- 1. Deploy the updated application code
-- 2. Run: npm run db:generate (to regenerate Prisma client)
-- 3. Verify the app works correctly
