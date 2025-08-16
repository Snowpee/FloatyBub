-- 检查和修复 chat_sessions 表的权限配置
-- 这个脚本用于诊断和修复 CHANNEL_ERROR 问题

-- 1. 检查当前权限
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'chat_sessions' 
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 2. 检查 RLS 策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'chat_sessions';

-- 3. 确保 anon 角色有基本的 SELECT 权限
GRANT SELECT ON chat_sessions TO anon;

-- 4. 确保 authenticated 角色有完整权限
GRANT ALL PRIVILEGES ON chat_sessions TO authenticated;

-- 5. 检查 Realtime publication 配置
-- 注意：Realtime 配置通常在 Supabase Dashboard 中管理
SELECT 
    pubname,
    puballtables
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- 6. 检查表是否在 publication 中
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_sessions';

-- 7. 验证权限修复结果
SELECT 
    'Permissions check completed' as status,
    'Check Supabase Dashboard for Realtime settings' as note;