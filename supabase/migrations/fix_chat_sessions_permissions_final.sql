-- 修复 chat_sessions 表权限配置
-- 确保 anon 和 authenticated 角色有正确的访问权限

-- 首先检查当前权限状态
SELECT 'Current permissions for chat_sessions:' as info;
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'chat_sessions' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 撤销可能存在的错误权限
REVOKE ALL ON chat_sessions FROM anon;
REVOKE ALL ON chat_sessions FROM authenticated;

-- 为 anon 角色授予基本读取权限（用于未登录用户的基本访问）
GRANT SELECT ON chat_sessions TO anon;

-- 为 authenticated 角色授予完整权限（用于已登录用户）
GRANT ALL PRIVILEGES ON chat_sessions TO authenticated;

-- 确保 RLS 策略正确启用
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- 检查 RLS 策略是否存在
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'chat_sessions';

-- 如果没有适当的 RLS 策略，创建基本策略
-- 允许用户访问自己的聊天会话
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat sessions" ON chat_sessions;
CREATE POLICY "Users can insert own chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
CREATE POLICY "Users can update own chat sessions" ON chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;
CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- 验证权限配置
SELECT 'Updated permissions for chat_sessions:' as info;
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'chat_sessions' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 验证 RLS 策略
SELECT 'RLS policies for chat_sessions:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'chat_sessions';