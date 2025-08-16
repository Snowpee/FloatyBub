// 浏览器端认证状态检查脚本
// 在浏览器控制台中运行此脚本

(async function checkBrowserAuthState() {
  console.log('🔍 浏览器端认证状态检查...');
  console.log('='.repeat(50));
  
  try {
    // 1. 检查localStorage中的Supabase认证数据
    console.log('📋 1. localStorage认证数据检查');
    
    const supabaseUrl = window.location.origin.includes('localhost') 
      ? 'https://your-project.supabase.co' // 替换为实际的Supabase URL
      : 'https://your-project.supabase.co';
    
    // 查找所有可能的Supabase认证键
    const authKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('supabase') && key.includes('auth')) {
        authKeys.push(key);
      }
    }
    
    console.log('找到的认证键:', authKeys);
    
    authKeys.forEach(key => {
      const authData = localStorage.getItem(key);
      console.log(`\n认证键: ${key}`);
      
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          console.log('- 用户ID:', parsed.user?.id || '无');
          console.log('- 用户邮箱:', parsed.user?.email || '无');
          console.log('- 访问令牌:', parsed.access_token ? '存在' : '不存在');
          console.log('- 刷新令牌:', parsed.refresh_token ? '存在' : '不存在');
          
          if (parsed.expires_at) {
            const expiresAt = new Date(parsed.expires_at * 1000);
            const now = new Date();
            console.log('- 令牌过期时间:', expiresAt.toLocaleString());
            console.log('- 当前时间:', now.toLocaleString());
            console.log('- 令牌是否过期:', now > expiresAt);
          }
        } catch (error) {
          console.error('- 解析认证数据失败:', error.message);
        }
      } else {
        console.log('- 认证数据为空');
      }
    });
    
    // 2. 检查全局Supabase客户端状态
    console.log('\n📋 2. 全局Supabase客户端检查');
    
    if (typeof window !== 'undefined' && window.supabase) {
      console.log('✅ 全局supabase客户端存在');
      
      try {
        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error) {
          console.error('❌ 获取会话失败:', error.message);
        } else {
          console.log('会话状态:', session ? '已登录' : '未登录');
          
          if (session) {
            console.log('- 用户ID:', session.user.id);
            console.log('- 用户邮箱:', session.user.email);
            console.log('- 访问令牌存在:', !!session.access_token);
            console.log('- 令牌过期时间:', new Date(session.expires_at * 1000).toLocaleString());
            console.log('- 令牌是否过期:', Date.now() > session.expires_at * 1000);
          }
        }
        
        // 检查用户认证状态
        const { data: { user }, error: userError } = await window.supabase.auth.getUser();
        
        if (userError) {
          console.error('❌ 获取用户失败:', userError.message);
        } else {
          console.log('用户认证状态:', user ? '已认证' : '未认证');
        }
        
      } catch (error) {
        console.error('❌ Supabase客户端操作失败:', error.message);
      }
    } else {
      console.log('❌ 全局supabase客户端不存在');
    }
    
    // 3. 检查React应用状态（如果可访问）
    console.log('\n📋 3. React应用状态检查');
    
    // 尝试访问React DevTools或全局状态
    if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('✅ React DevTools可用');
    } else {
      console.log('⚠️ React DevTools不可用');
    }
    
    // 4. 检查网络连接状态
    console.log('\n📋 4. 网络连接状态检查');
    console.log('在线状态:', navigator.onLine ? '在线' : '离线');
    
    // 5. 尝试手动刷新认证状态
    console.log('\n📋 5. 手动刷新认证状态');
    
    if (typeof window !== 'undefined' && window.supabase) {
      try {
        console.log('尝试刷新令牌...');
        const { data, error } = await window.supabase.auth.refreshSession();
        
        if (error) {
          console.error('❌ 刷新令牌失败:', error.message);
        } else {
          console.log('✅ 刷新令牌成功');
          console.log('新会话状态:', data.session ? '已登录' : '未登录');
        }
      } catch (error) {
        console.error('❌ 刷新令牌异常:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ 浏览器端认证检查失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
  
  console.log('\n🏁 浏览器端认证状态检查完成');
})();

// 使用说明：
// 1. 打开浏览器开发者工具
// 2. 切换到Console标签
// 3. 复制并粘贴此脚本
// 4. 按Enter执行