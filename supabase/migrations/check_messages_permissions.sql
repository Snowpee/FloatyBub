-- 检查和修复 messages 表的权限配置
-- 确保 anon 和 authenticated 角色有正确的访问权限

-- 1. 检查当前权限
SELECT 'Current permissions for messages:' as info;
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'messages' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 2. 检查 RLS 策略
SELECT 'RLS policies for messages:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages';

-- 3. 检查 RLS 是否启用
SELECT 'RLS status for messages:' as info;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- 4. 如果没有权限，则添加权限
-- 撤销可能存在的错误权限
REVOKE ALL ON messages FROM anon;
REVOKE ALL ON messages FROM authenticated;

-- 为 anon 角色授予基本读取权限
GRANT SELECT ON messages TO anon;

-- 为 authenticated 角色授予完整权限
GRANT ALL PRIVILEGES ON messages TO authenticated;

-- 5. 确保 RLS 策略正确启用
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 6. 创建或更新 RLS 策略
-- 允许用户访问属于自己聊天会话的消息
DROP POLICY IF EXISTS "Users can view messages in own sessions" ON messages;
CREATE POLICY "Users can view messages in own sessions" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE chat_sessions.id = messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert messages in own sessions" ON messages;
CREATE POLICY "Users can insert messages in own sessions" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE chat_sessions.id = messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update messages in own sessions" ON messages;
CREATE POLICY "Users can update messages in own sessions" ON messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE chat_sessions.id = messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete messages in own sessions" ON messages;
CREATE POLICY "Users can delete messages in own sessions" ON messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE chat_sessions.id = messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- 7. 验证权限配置
SELECT 'Updated permissions for messages:' as info;
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'messages' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 8. 验证 RLS 策略
SELECT 'Updated RLS policies for messages:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'messages';