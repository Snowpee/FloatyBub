-- 手动修复chat_sessions表权限
-- 这个脚本需要在Supabase Dashboard的SQL编辑器中执行

-- 1. 为anon角色授予INSERT权限（用于测试）
GRANT INSERT ON chat_sessions TO anon;
GRANT INSERT ON messages TO anon;

-- 2. 检查当前权限状态
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND grantee IN ('anon', 'authenticated') 
    AND table_name IN ('chat_sessions', 'messages')
ORDER BY table_name, grantee;

-- 3. 检查RLS策略状态
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('chat_sessions', 'messages');

-- 4. 查看现有RLS策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('chat_sessions', 'messages')
ORDER BY tablename, policyname;