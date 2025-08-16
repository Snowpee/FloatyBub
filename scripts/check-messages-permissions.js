import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// 使用正确的Supabase配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRicWdobnBxcW5jZnlkcm5xcG9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIxMTQzOSwiZXhwIjoyMDY5Nzg3NDM5fQ.luOL6-JmaHdUZ36ZD-KBL37iBqlKvg8CY8IKa6JF2nQ';

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 检查 messages 表权限和RLS策略...');

async function checkMessagesPermissions() {
  try {
    console.log('\n=== 1. 检查 messages 表权限 ===');
    
    // 查询当前权限
    const { data: permissions, error: permError } = await serviceClient
      .rpc('sql', {
        query: `
          SELECT grantee, table_name, privilege_type 
          FROM information_schema.role_table_grants 
          WHERE table_schema = 'public' 
            AND table_name = 'messages' 
            AND grantee IN ('anon', 'authenticated') 
          ORDER BY table_name, grantee;
        `
      });
    
    if (permError) {
      console.log('❌ 权限查询失败:', permError.message);
    } else {
      console.log('📋 messages表当前权限:');
      if (permissions && permissions.length > 0) {
        permissions.forEach(perm => {
          console.log(`  角色: ${perm.grantee}, 权限: ${perm.privilege_type}`);
        });
      } else {
        console.log('  ⚠️  未找到 anon 或 authenticated 角色的权限');
      }
    }
    
    console.log('\n=== 2. 检查 messages 表 RLS 策略 ===');
    
    // 查询RLS策略
    const { data: rlsPolicies, error: rlsError } = await serviceClient
      .rpc('sql', {
        query: `
          SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
          FROM pg_policies 
          WHERE tablename = 'messages';
        `
      });
    
    if (rlsError) {
      console.log('❌ RLS策略查询失败:', rlsError.message);
    } else {
      console.log('📋 messages表RLS策略:');
      if (rlsPolicies && rlsPolicies.length > 0) {
        rlsPolicies.forEach(policy => {
          console.log(`  策略名: ${policy.policyname}`);
          console.log(`  命令: ${policy.cmd}`);
          console.log(`  角色: ${policy.roles}`);
          console.log(`  条件: ${policy.qual}`);
          console.log('  ---');
        });
      } else {
        console.log('  ⚠️  未找到 messages 表的 RLS 策略');
      }
    }
    
    console.log('\n=== 3. 检查 RLS 是否启用 ===');
    
    // 检查RLS是否启用
    const { data: rlsStatus, error: rlsStatusError } = await serviceClient
      .rpc('sql', {
        query: `
          SELECT tablename, rowsecurity 
          FROM pg_tables 
          WHERE schemaname = 'public' 
            AND tablename = 'messages';
        `
      });
    
    if (rlsStatusError) {
      console.log('❌ RLS状态查询失败:', rlsStatusError.message);
    } else {
      console.log('📋 messages表RLS状态:');
      if (rlsStatus && rlsStatus.length > 0) {
        rlsStatus.forEach(table => {
          console.log(`  表: ${table.tablename}, RLS启用: ${table.rowsecurity}`);
        });
      }
    }
    
    console.log('\n=== 4. 测试表访问 ===');
    
    // 测试基本访问
    try {
      const { data: messagesCount, error: countError } = await serviceClient
        .from('messages')
        .select('count', { count: 'exact', head: true });
      
      if (countError) {
        console.log('❌ messages表访问失败:', countError.message);
      } else {
        console.log('✅ messages表访问成功，记录数:', messagesCount);
      }
    } catch (error) {
      console.log('❌ messages表访问异常:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
  }
}

// 运行检查
checkMessagesPermissions().then(() => {
  console.log('\n🏁 messages表权限检查完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 检查失败:', error);
  process.exit(1);
});