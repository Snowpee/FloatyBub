# AI聊天工具开源部署指南

## 🎯 项目概述

本项目是一个基于React + Supabase的AI聊天工具，支持用户系统、会话管理和实时同步。为了提升开源项目的易用性，我们提供了完整的一键部署方案。

## 📋 部署前准备

### 必需服务
1. **Supabase账户** - 免费额度足够个人使用
2. **Vercel账户** - 免费部署静态网站
3. **GitHub账户** - 代码托管和自动部署

### 预估时间
- 首次部署：15-20分钟
- 后续更新：自动部署，1-3分钟

## 🚀 一键部署方案

### 方案1：使用Deploy按钮（推荐）

1. **点击部署按钮**
   ```
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/floaty-bub&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY&envDescription=Supabase配置信息&envLink=https://supabase.com/dashboard/project/_/settings/api)
   ```

2. **配置环境变量**
   - `VITE_SUPABASE_URL`: 你的Supabase项目URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase匿名密钥

3. **完成部署**
   - Vercel自动构建和部署
   - 获得生产环境URL

### 方案2：手动部署

1. **Fork项目**
   ```bash
   git clone https://github.com/your-username/floaty-bub.git
   cd floaty-bub
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local 文件
   ```

4. **连接Vercel**
   ```bash
   npx vercel
   npx vercel --prod
   ```

## 🗄️ 数据库自动初始化

### 可行性分析

✅ **技术可行性**
- Supabase提供完整的REST API和管理API
- 支持通过SQL脚本创建表结构和RLS策略
- 可以通过Service Role Key执行管理操作

✅ **安全性**
- 使用临时的Service Role Key进行初始化
- 初始化完成后可以撤销或轮换密钥
- 所有操作都有审计日志

✅ **用户体验**
- 一键初始化，无需手动执行SQL
- 自动检测表是否已存在，避免重复创建
- 提供初始化状态反馈和错误处理

### 实现方案

#### 方案A：Web界面初始化（推荐）

在项目中添加一个管理页面 `/setup`，用户首次访问时自动引导进行数据库初始化。

**优势：**
- 用户友好的图形界面
- 实时反馈初始化进度
- 可以验证配置正确性
- 支持重新初始化

**实现步骤：**
1. 创建Setup页面组件
2. 检测数据库表是否存在
3. 提供一键初始化按钮
4. 显示初始化进度和结果

#### 方案B：CLI工具初始化

提供命令行工具进行数据库初始化。

```bash
# 安装CLI工具
npm install -g @floaty-bub/setup-cli

# 初始化数据库
floaty-bub-setup --url=your-supabase-url --key=your-service-key
```

**优势：**
- 适合技术用户
- 可以集成到CI/CD流程
- 支持批量部署

#### 方案C：Docker一键部署

提供Docker Compose配置，包含应用和数据库初始化。

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
  
  db-setup:
    image: supabase/postgres
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    volumes:
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
```

## 📝 环境变量配置模板

### .env.example
```bash
# ===========================================
# Supabase 配置 (必需)
# ===========================================
# 从 https://supabase.com/dashboard/project/_/settings/api 获取
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# ===========================================
# 应用配置 (可选)
# ===========================================
VITE_APP_NAME=AI聊天工具
VITE_APP_VERSION=1.0.0
VITE_APP_DESCRIPTION=基于AI的智能聊天助手

# ===========================================
# 功能开关 (可选)
# ===========================================
VITE_ENABLE_USER_SYSTEM=true
VITE_ENABLE_VOICE_CHAT=true
VITE_ENABLE_FILE_UPLOAD=false

# ===========================================
# 第三方服务 (可选)
# ===========================================
# Google Analytics
VITE_GA_TRACKING_ID=G-XXXXXXXXXX

# Sentry错误监控
VITE_SENTRY_DSN=https://your-sentry-dsn
```

### Vercel环境变量配置

在Vercel Dashboard中配置以下环境变量：

| 变量名 | 值 | 说明 |
|--------|----|---------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase项目URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Supabase匿名密钥 |
| `VITE_APP_NAME` | `我的AI助手` | 应用名称 |

## 🛠️ 数据库初始化脚本

### 完整SQL脚本

创建 `scripts/init-database.sql` 文件：

```sql
-- =============================================
-- AI聊天工具数据库初始化脚本
-- =============================================

-- 检查表是否已存在，避免重复创建
DO $$
BEGIN
    -- 创建用户资料表
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        CREATE TABLE user_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            display_name VARCHAR(100),
            avatar_url TEXT,
            preferences JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- 创建索引
        CREATE UNIQUE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
        CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at DESC);
        
        -- 启用行级安全
        ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
        
        -- 创建RLS策略
        CREATE POLICY "用户只能访问自己的资料" ON user_profiles
            FOR ALL USING (auth.uid() = user_id);
            
        RAISE NOTICE '✅ user_profiles 表创建成功';
    ELSE
        RAISE NOTICE '⚠️ user_profiles 表已存在，跳过创建';
    END IF;
    
    -- 创建聊天会话表
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_sessions') THEN
        CREATE TABLE chat_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL DEFAULT '新对话',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- 创建索引
        CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
        CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
        
        -- 启用行级安全
        ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
        
        -- 创建RLS策略
        CREATE POLICY "用户只能访问自己的会话" ON chat_sessions
            FOR ALL USING (auth.uid() = user_id);
            
        RAISE NOTICE '✅ chat_sessions 表创建成功';
    ELSE
        RAISE NOTICE '⚠️ chat_sessions 表已存在，跳过创建';
    END IF;
    
    -- 创建消息表
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        CREATE TABLE messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            reasoning_content TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- 创建索引
        CREATE INDEX idx_messages_session_id ON messages(session_id);
        CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
        
        -- 启用行级安全
        ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
        
        -- 创建RLS策略
        CREATE POLICY "用户只能访问自己会话的消息" ON messages
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM chat_sessions 
                    WHERE chat_sessions.id = messages.session_id 
                    AND chat_sessions.user_id = auth.uid()
                )
            );
            
        RAISE NOTICE '✅ messages 表创建成功';
    ELSE
        RAISE NOTICE '⚠️ messages 表已存在，跳过创建';
    END IF;
END
$$;

-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表创建触发器
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 完成提示
RAISE NOTICE '🎉 数据库初始化完成！';
```

### JavaScript初始化工具

创建 `scripts/setup-database.js` 文件：

```javascript
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.argv[2],
  serviceKey: process.env.SUPABASE_SERVICE_KEY || process.argv[3],
};

// 验证配置
if (!config.supabaseUrl || !config.serviceKey) {
  console.error('❌ 错误：缺少必需的配置参数');
  console.log('使用方法：');
  console.log('  node setup-database.js <SUPABASE_URL> <SERVICE_KEY>');
  console.log('  或设置环境变量：SUPABASE_URL 和 SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// 创建Supabase客户端
const supabase = createClient(config.supabaseUrl, config.serviceKey);

// 读取SQL脚本
const sqlScript = fs.readFileSync(
  path.join(__dirname, 'init-database.sql'),
  'utf8'
);

// 执行数据库初始化
async function setupDatabase() {
  console.log('🚀 开始初始化数据库...');
  
  try {
    // 执行SQL脚本
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlScript
    });
    
    if (error) {
      console.error('❌ 数据库初始化失败：', error.message);
      process.exit(1);
    }
    
    console.log('✅ 数据库初始化成功！');
    console.log('📋 已创建的表：');
    console.log('  - user_profiles (用户资料)');
    console.log('  - chat_sessions (聊天会话)');
    console.log('  - messages (消息记录)');
    console.log('🔒 已配置行级安全策略');
    console.log('🎉 可以开始使用应用了！');
    
  } catch (err) {
    console.error('❌ 执行过程中出错：', err.message);
    process.exit(1);
  }
}

// 检查数据库连接
async function checkConnection() {
  try {
    const { data, error } = await supabase
      .from('pg_tables')
      .select('tablename')
      .limit(1);
      
    if (error) {
      console.error('❌ 数据库连接失败：', error.message);
      console.log('请检查：');
      console.log('  1. SUPABASE_URL 是否正确');
      console.log('  2. SERVICE_KEY 是否有效');
      console.log('  3. 网络连接是否正常');
      process.exit(1);
    }
    
    console.log('✅ 数据库连接成功');
    return true;
  } catch (err) {
    console.error('❌ 连接检查失败：', err.message);
    process.exit(1);
  }
}

// 主函数
async function main() {
  console.log('🔧 AI聊天工具 - 数据库初始化工具');
  console.log('================================');
  
  await checkConnection();
  await setupDatabase();
  
  console.log('\n🎯 下一步：');
  console.log('  1. 配置前端环境变量');
  console.log('  2. 启动应用：npm run dev');
  console.log('  3. 访问 /setup 页面验证配置');
}

// 运行
main().catch(console.error);
```

## 📖 详细部署步骤

### 步骤1：创建Supabase项目

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击 "New Project"
3. 选择组织和输入项目名称
4. 选择数据库密码和地区
5. 等待项目创建完成（约2分钟）

### 步骤2：获取API密钥

1. 进入项目Dashboard
2. 点击左侧 "Settings" → "API"
3. 复制以下信息：
   - Project URL
   - anon public key
   - service_role key（仅用于初始化）

### 步骤3：初始化数据库

**方法A：使用Web界面（推荐）**
1. 部署应用到Vercel
2. 访问 `https://your-app.vercel.app/setup`
3. 输入Supabase配置信息
4. 点击"初始化数据库"按钮

**方法B：使用命令行工具**
```bash
# 克隆项目
git clone https://github.com/your-username/floaty-bub.git
cd floaty-bub

# 安装依赖
npm install

# 运行初始化脚本
node scripts/setup-database.js \
  https://your-project.supabase.co \
  your-service-role-key
```

### 步骤4：配置认证

1. 在Supabase Dashboard中：
2. 点击 "Authentication" → "Settings"
3. 配置以下选项：
   - Enable email confirmations: 开启
   - Enable email change confirmations: 开启
   - Site URL: `https://your-app.vercel.app`
4. 可选：配置OAuth提供商（Google、GitHub等）

### 步骤5：部署到Vercel

1. **使用Deploy按钮**
   - 点击项目README中的Deploy按钮
   - 连接GitHub账户
   - 配置环境变量
   - 等待部署完成

2. **手动部署**
   ```bash
   # 安装Vercel CLI
   npm i -g vercel
   
   # 登录Vercel
   vercel login
   
   # 部署项目
   vercel
   
   # 生产部署
   vercel --prod
   ```

### 步骤6：验证部署

1. 访问部署的URL
2. 测试用户注册和登录
3. 创建聊天会话
4. 检查数据是否正确保存

## 🔧 故障排除

### 常见问题

**Q: 数据库连接失败**
A: 检查以下项目：
- Supabase URL格式是否正确
- API密钥是否有效
- 项目是否已激活

**Q: 认证不工作**
A: 确认以下配置：
- Site URL设置正确
- 邮箱确认已开启
- 重定向URL配置正确

**Q: 部署失败**
A: 检查以下内容：
- 环境变量是否正确设置
- 构建命令是否正确
- 依赖是否完整安装

### 调试工具

1. **检查Supabase连接**
   ```javascript
   // 在浏览器控制台运行
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
   ```

2. **检查数据库表**
   ```sql
   -- 在Supabase SQL编辑器中运行
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

3. **检查RLS策略**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

## 📚 参考资源

- [Supabase文档](https://supabase.com/docs)
- [Vercel部署指南](https://vercel.com/docs)
- [React官方文档](https://react.dev)
- [项目GitHub仓库](https://github.com/your-username/floaty-bub)

## 🤝 社区支持

- [GitHub Issues](https://github.com/your-username/floaty-bub/issues)
- [Discord社区](https://discord.gg/your-invite)
- [文档反馈](mailto:feedback@your-domain.com)

---

**🎉 恭喜！你已经成功部署了AI聊天工具！**

如果遇到任何问题，请查看故障排除部分或在GitHub上提交Issue。