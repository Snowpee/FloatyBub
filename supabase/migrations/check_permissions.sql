-- 检查knowledge_bases表的权限配置
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'knowledge_bases' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 检查RLS策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'knowledge_bases';