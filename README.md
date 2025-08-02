# AI聊天工具 🤖

一个现代化的AI聊天工具，支持多种大语言模型，提供流畅的对话体验和丰富的自定义功能。

> 使用 [TRAE SOLO](https://trae.ai) 开发

## ✨ 功能特性

### 🎯 核心功能
- **多模型支持**: 支持 OpenAI GPT、Claude、Gemini、通义千问等主流大语言模型
- **流式输出**: 实时显示AI回复，提供流畅的对话体验
- **智能角色系统**: 支持自定义AI角色、系统提示词和个性化开场白
- **用户资料管理**: 支持多用户资料切换，个性化对话体验
- **全局提示词**: 可复用的提示词模板，提升对话质量
- **语音功能**: 集成 Fish Audio TTS，支持文本转语音和语音克隆
- **会话管理**: 完整的聊天历史记录、会话搜索和分类管理
- **配置管理**: 灵活的模型配置和API密钥管理
- **数据导入导出**: 支持完整的数据备份和迁移

### 🎨 用户体验
- **现代化界面**: 基于 DaisyUI 的精美设计系统
- **多主题支持**: 支持亮色、深色、纸杯蛋糕、浮光等多种主题
- **响应式设计**: 完美适配桌面端和移动端，优化移动端交互
- **智能通知**: 优雅通知系统，支持 DaisyUI 样式
- **本地存储**: 安全的本地数据存储，保护隐私

### 🔧 技术特色
- **TypeScript**: 完整的类型安全保障
- **组件化架构**: 高度模块化和可维护的代码结构
- **状态管理**: 基于 Zustand 的轻量级状态管理
- **实时通信**: Server-Sent Events 实现流式数据传输
- **Markdown 渲染**: 支持代码高亮和 GitHub 风格的 Markdown
- **移动端优化**: 针对移动设备的交互优化和适配

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 6
- **样式方案**: Tailwind CSS 4 + DaisyUI 5
- **状态管理**: Zustand 5
- **路由管理**: React Router DOM 7
- **图标库**: Lucide React
- **通知组件**: Sonner 2
- **Markdown**: React Markdown + Rehype Highlight
- **代码高亮**: Highlight.js
- **语音服务**: Fish Audio TTS API
- **部署平台**: Vercel

## 🚀 快速开始

### 环境要求
- Node.js 22.x (推荐) 或 18.0+
- pnpm 或 npm

### 安装依赖
```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install
```

### 启动开发服务器
```bash
# 使用 pnpm
pnpm dev

# 或使用 npm
npm run dev
```

访问 [http://localhost:5173](http://localhost:5173) 查看应用。

### 构建生产版本
```bash
# 使用 pnpm
pnpm build

# 或使用 npm
npm run build
```

## 📖 使用指南

### 1. 配置LLM服务
1. 点击设置按钮，进入"模型"配置页面
2. 添加新的模型配置
3. 填写API密钥、基础URL等信息
4. 保存配置

### 2. 创建AI角色
1. 在设置中进入"角色卡"页面
2. 点击"添加角色"按钮
3. 设置角色名称、描述、系统提示词和开场白
4. 可选择关联全局提示词模板
5. 上传自定义头像（可选）
6. 保存角色设置

### 3. 配置用户资料
1. 在设置中进入"用户角色"页面
2. 创建或编辑用户资料
3. 设置用户名、描述、个人信息等
4. 可上传个人头像
5. 切换不同用户资料以获得个性化体验

### 4. 语音功能设置
1. 在设置中进入"语音"页面
2. 配置 Fish Audio API 密钥
3. 选择语音模型和参数
4. 测试语音合成功能
5. 支持文本转语音和语音克隆

### 5. 开始聊天
1. 在首页选择AI角色
2. 系统会自动显示角色的开场白
3. 开始与AI对话
4. 支持实时流式回复和 Markdown 渲染

### 6. 管理会话
- 在"历史"页面查看所有会话
- 支持按角色、模型、时间筛选会话
- 支持会话搜索和导出
- 点击"查看会话"按钮继续对话
- 支持隐藏和删除会话

## 🎵 语音功能详细配置

### 功能特性
- 🔐 安全的后端代理服务，保护 API 密钥
- 🎵 支持多种音频格式（MP3、WAV）
- 🎤 支持语音克隆（上传参考音频）
- 📱 响应式前端测试界面
- 🌐 跨域支持，便于开发和部署

### 快速开始

#### 1. 获取 Fish Audio API 密钥
1. 访问 [Fish Audio 官网](https://fish.audio/)
2. 注册账号并获取 API 密钥
3. 保存你的 API 密钥，稍后需要配置

#### 2. 配置后端服务
```bash
# 进入后端服务目录
cd tts-server

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，添加你的 API 密钥
# 将 your_fish_audio_api_key_here 替换为实际的 API 密钥
vim .env  # 或使用其他编辑器
```

#### 3. 启动服务

**方法一：使用启动脚本（推荐）**
```bash
# 在项目根目录下运行
./start-tts-server.sh
```

**方法二：手动启动**
```bash
# 启动后端服务
cd tts-server
npm run dev

# 在另一个终端启动前端服务
cd ..
npm run dev
```

#### 4. 访问测试页面
1. 确保前端服务运行在 `http://localhost:5173`
2. 确保后端服务运行在 `http://localhost:3001`
3. 在浏览器中访问前端应用
4. 点击侧边栏的「语音测试」按钮
5. 或直接访问 `http://localhost:5173/voice-test`

### 使用说明

#### 基础文本转语音
1. 在文本框中输入要转换的内容
2. 选择音频格式（MP3/WAV）
3. 调整比特率、延迟模式等参数
4. 点击「生成语音」按钮
5. 等待生成完成后播放或下载音频

#### 语音克隆功能
1. 点击「添加音频」按钮上传参考音频文件
2. 为每个参考音频输入对应的文本内容
3. 输入要转换的目标文本
4. 生成语音时会基于参考音频的声音特征

#### 配置选项说明
- **音频格式**: MP3 或 WAV
- **MP3 比特率**: 64/128/192/320 kbps
- **延迟模式**: 普通/平衡（影响生成速度和质量）
- **文本块长度**: 单次处理的文本长度（50-500）
- **预设语音 ID**: 使用预设的语音模型
- **标准化音频**: 是否对输出音频进行标准化处理

### 故障排除

#### 后端服务无法启动
1. **检查端口占用**:
   ```bash
   lsof -i :3001
   ```

2. **检查依赖安装**:
   ```bash
   cd tts-server
   rm -rf node_modules
   npm install
   ```

3. **检查 API 密钥配置**:
   ```bash
   cat tts-server/.env
   ```

#### API 调用失败
1. **检查 API 密钥是否有效**:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" https://api.fish.audio/v1/models
   ```

2. **检查网络连接**:
   ```bash
   ping api.fish.audio
   ```

3. **查看后端日志**: 后端服务会输出详细的错误信息，检查控制台日志

#### 前端页面错误
1. **检查服务器状态**: 页面顶部会显示后端服务器的连接状态
2. **清除浏览器缓存**: 强制刷新页面（Ctrl+F5 或 Cmd+Shift+R）
3. **检查控制台错误**: 打开浏览器开发者工具查看错误信息

#### 音频生成缓慢
1. **调整文本块长度**: 减小 `chunk_length` 参数
2. **选择平衡延迟模式**: 在配置中选择「平衡」模式
3. **检查网络状况**: 确保网络连接稳定

## 🌐 部署到 Vercel

本项目已配置为支持 Vercel Serverless Functions，可以将前端和后端一起部署到 Vercel 平台。

### 🚀 部署步骤

#### 1. 准备代码
确保你的代码已经推送到 GitHub 仓库：
```bash
git add .
git commit -m "配置 Vercel Serverless Functions"
git push origin main
```

#### 2. 连接 Vercel
1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录
3. 点击 "New Project"
4. 导入你的 GitHub 仓库
5. 选择项目并点击 "Import"

#### 3. 配置环境变量
在 Vercel 项目设置中添加环境变量：
1. 进入项目 Dashboard
2. 点击 "Settings" 标签
3. 选择 "Environment Variables"
4. 添加以下变量：

```
FISH_AUDIO_API_KEY = your_fish_audio_api_key_here
VITE_API_SECRET = your_secret_api_key_here // 前端 API 密钥
API_SECRET = your_secret_api_key_here // 后端 API 密钥
```

**重要**: 将 `your_fish_audio_api_key_here` 替换为你的实际 Fish Audio API 密钥。

#### 4. 部署
1. 点击 "Deploy" 按钮
2. 等待部署完成（通常需要 1-3 分钟）
3. 部署成功后，你会获得一个 `.vercel.app` 域名

### 🔧 API 端点
部署后可用的 API 端点：
- `GET /api/health` - 健康检查
- `POST /api/tts` - 文本转语音
- `GET /api/models` - 获取可用模型列表

### 🌐 访问应用
部署完成后：
1. 访问你的 Vercel 域名（如：`https://your-project.vercel.app`）
2. 直接访问语音测试页面：`https://your-project.vercel.app/voice-test`
3. 应用会自动检测环境并使用正确的 API 地址

### 🔍 故障排除

#### 部署失败
1. **检查构建日志**：在 Vercel Dashboard 中查看详细的构建日志
2. **检查依赖**：确保 `api/package.json` 中的依赖正确
3. **检查语法**：确保所有 JavaScript 文件语法正确

#### API 调用失败
1. **检查环境变量**：确保 `FISH_AUDIO_API_KEY` 已正确设置
2. **检查 API 密钥**：确保 Fish Audio API 密钥有效且有足够配额
3. **查看函数日志**：在 Vercel Dashboard 的 "Functions" 标签中查看日志

#### 前端错误
1. **清除缓存**：强制刷新浏览器（Ctrl+F5 或 Cmd+Shift+R）
2. **检查控制台**：打开浏览器开发者工具查看错误信息
3. **检查网络**：确保网络连接正常

### ⚡ 性能优化

#### Serverless Functions 限制
- **执行时间**：最大 30 秒（TTS 函数）
- **内存**：默认 1024MB
- **冷启动**：首次调用可能有 1-2 秒延迟

#### 优化建议
1. **文本长度**：建议单次转换文本不超过 500 字符
2. **并发请求**：避免同时发起多个 TTS 请求
3. **缓存策略**：考虑在前端缓存生成的音频

### 📊 监控和分析
在 Vercel Dashboard 中可以查看：
- **函数调用次数**：监控 API 使用情况
- **响应时间**：优化性能
- **错误率**：及时发现问题
- **带宽使用**：控制成本

### 💰 成本估算
Vercel 免费计划包括：
- **函数调用**：每月 100GB-小时
- **带宽**：每月 100GB
- **构建时间**：每月 6000 分钟

对于中等使用量的 TTS 应用，免费计划通常足够使用。

## 🔒 安全配置

### 概述
为了保护 TTS API 免受未授权访问，我们已经实现了 API 密钥验证机制。所有 API 请求都需要在请求头中包含有效的 API 密钥。

### 环境变量配置

#### 1. 本地开发环境
在项目根目录创建 `.env` 文件：
```bash
# 前端 API 密钥（用于调用后端 API）
VITE_API_SECRET=your-secret-api-key-here

# Fish Audio API 密钥
FISH_AUDIO_API_KEY=your-fish-audio-api-key-here
```

#### 2. TTS 服务器环境
在 `tts-server` 目录创建 `.env` 文件：
```bash
# Fish Audio API 配置
FISH_AUDIO_API_KEY=your_fish_audio_api_key_here

# API 安全配置
API_SECRET=your_secret_api_key_here

# 服务器配置
PORT=3001
```

#### 3. Vercel 部署环境
在 Vercel 项目设置中配置以下环境变量：
- `API_SECRET`: 用于验证 API 访问的密钥
- `FISH_AUDIO_API_KEY`: Fish Audio 平台的 API 密钥
- `VITE_API_SECRET`: 前端 API 密钥（用于调用后端 API）

### API 使用方式

#### 请求头格式
所有 API 请求都必须包含以下请求头：
```javascript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': 'your-api-key-here'
}
```

#### 受保护的端点
以下端点需要 API 密钥验证：
- `GET /api/tts` - 获取支持的模型列表
- `POST /api/tts` - 文本转语音
- `GET /api/health` - 健康检查

### 安全建议

#### 1. API 密钥管理
- 使用强密码生成器创建复杂的 API 密钥
- 定期轮换 API 密钥
- 不要在代码中硬编码 API 密钥
- 不要将 `.env` 文件提交到版本控制系统

#### 2. 生产环境安全
- 在 Vercel 环境变量中设置 API 密钥
- 考虑实现请求频率限制
- 监控 API 使用情况
- 记录访问日志

#### 3. 网络安全
- 使用 HTTPS 进行所有 API 通信
- 考虑实现 IP 白名单（如果适用）
- 定期审查访问日志

### 错误处理

#### 常见错误响应
1. **缺少 API 密钥**
   ```json
   {
     "error": "未授权访问：无效的 API 密钥"
   }
   ```
   HTTP 状态码: 401

2. **服务器未配置密钥**
   ```json
   {
     "error": "服务器未配置 API 密钥"
   }
   ```
   HTTP 状态码: 500

### 示例代码

#### JavaScript/TypeScript
```javascript
// 获取模型列表
const response = await fetch('/api/tts', {
  method: 'GET',
  headers: {
    'x-api-key': process.env.VITE_API_SECRET
  }
});

// 文本转语音
const response = await fetch('/api/tts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.VITE_API_SECRET
  },
  body: JSON.stringify({
    text: '你好，世界！',
    model: 'speech-1.6'
  })
});
```

#### cURL
```bash
# 获取模型列表
curl -H "x-api-key: your-api-key-here" \
     https://your-domain.vercel.app/api/tts

# 文本转语音
curl -X POST \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key-here" \
     -d '{"text":"你好，世界！","model":"speech-1.6"}' \
     https://your-domain.vercel.app/api/tts
```

## 🛠️ 开发工具

### Git 提交脚本
本项目提供了两个便于 Git 提交的脚本，帮助你快速将代码提交并推送到 GitHub。

#### 脚本说明

**1. `deploy.sh` - 完整提交脚本**

功能特点：
- 🔍 检查工作区状态
- 📊 显示变更内容
- ✅ 提交前确认
- 🎨 彩色输出提示
- 🛡️ 错误处理和安全检查
- 📝 支持交互式输入提交信息

使用方法：
```bash
# 方式1：直接提供提交信息
./deploy.sh "feat: 添加用户头像功能"

# 方式2：交互式输入
./deploy.sh
# 然后根据提示输入提交信息
```

**2. `quick-commit.sh` - 快速提交脚本**

功能特点：
- ⚡ 快速提交，无需确认
- 🎯 简洁输出
- 📦 自动添加所有变更
- 🚀 一键推送到 GitHub

使用方法：
```bash
./quick-commit.sh "fix: 修复头像显示问题"
```

#### 快速开始
1. **确保脚本有执行权限**（已自动设置）：
   ```bash
   chmod +x deploy.sh quick-commit.sh
   ```

2. **选择合适的脚本**：
   - 重要更新或需要仔细检查：使用 `deploy.sh`
   - 日常小修改或快速迭代：使用 `quick-commit.sh`

#### 提交信息规范建议
推荐使用以下格式：
```
type(scope): description

[optional body]

[optional footer]
```

**类型 (type)：**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构代码
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例：**
```bash
./deploy.sh "feat(chat): 添加用户头像显示功能"
./quick-commit.sh "fix: 修复头像生成算法"
./deploy.sh "docs: 更新README文档"
```

#### 注意事项
1. **确保在 Git 仓库中运行**：脚本会自动检查
2. **网络连接**：推送需要网络连接到 GitHub
3. **远程仓库配置**：确保已正确配置远程仓库
4. **分支权限**：确保有推送到当前分支的权限
5. **Git Hooks**：脚本使用 `--no-verify` 选项跳过 Git hooks，避免因缺失模块或配置问题导致的提交失败

#### 故障排除
**推送失败？**
- 检查网络连接
- 确认 GitHub 认证信息
- 检查分支推送权限

**脚本无法执行？**
```bash
chmod +x deploy.sh quick-commit.sh
```

**提交被拒绝？**
- 先拉取最新代码：`git pull`
- 解决冲突后重新运行脚本

💡 **小贴士**：建议将这些脚本添加到你的 shell 别名中，例如：
```bash
# 在 ~/.zshrc 或 ~/.bashrc 中添加
alias deploy='./deploy.sh'
alias qc='./quick-commit.sh'
```

这样你就可以直接使用 `deploy "提交信息"` 或 `qc "提交信息"` 了！

## 📁 项目结构

```
src/
├── components/          # 可复用组件
│   ├── Layout.tsx      # 应用布局组件
│   ├── Avatar.tsx      # 头像组件
│   ├── AvatarUpload.tsx # 头像上传组件
│   ├── RoleAvatarUpload.tsx # 角色头像上传组件
│   ├── ChatSessionList.tsx # 聊天会话列表
│   ├── ConfirmDialog.tsx # 确认对话框组件
│   ├── Empty.tsx       # 空状态组件
│   ├── EmptyState.tsx  # 空状态组件
│   ├── MarkdownRenderer.tsx # Markdown渲染器
│   ├── Popconfirm.tsx  # 弹出确认组件
│   ├── RoleSelector.tsx # 角色选择器
│   ├── ToastContainer.tsx # 通知容器组件
│   └── SettingsModal.tsx # 设置弹窗组件
├── pages/              # 页面组件
│   ├── Home.tsx        # 首页
│   ├── ChatPage.tsx    # 聊天页面
│   ├── ConfigPage.tsx  # 模型配置页面
│   ├── RolesPage.tsx   # AI角色管理页面
│   ├── UserProfilesPage.tsx # 用户资料管理页面
│   ├── GlobalPromptsPage.tsx # 全局提示词页面
│   ├── VoiceSettingsPage.tsx # 语音设置页面
│   ├── HistoryPage.tsx # 聊天历史页面
│   ├── DataPage.tsx    # 数据管理页面
│   ├── SettingsPage.tsx # 设置页面
│   ├── NotFound.tsx    # 404页面
│   └── tests/          # 测试页面
│       ├── VoiceTest.tsx # 语音测试页面
│       └── ToastTestPage.tsx # 通知测试页面
├── store/              # 状态管理
│   └── index.ts        # Zustand store
├── hooks/              # 自定义Hooks
│   └── useToast.ts     # 通知Hook
├── utils/              # 工具函数
│   ├── avatarUtils.ts  # 头像工具函数
│   └── templateUtils.ts # 模板工具函数
├── router/             # 路由配置
│   └── index.tsx       # 路由定义
├── lib/                # 工具函数
│   └── utils.ts        # 通用工具函数
├── assets/             # 静态资源
│   ├── avatar/         # 默认头像资源
│   └── react.svg       # React图标
├── App.tsx             # 应用主组件
├── main.tsx            # 应用入口
├── index.css           # 全局样式
└── vite-env.d.ts       # Vite类型定义
```

### 语音功能相关文件
```
api/                    # Vercel Serverless Functions
├── tts.js              # TTS API 接口
├── models.js           # 模型列表接口
├── model-info.js       # 模型信息接口
├── health.js           # 健康检查接口
├── validate-key.js     # API密钥验证
└── package.json        # API依赖配置

tts-server/             # 本地TTS服务器
├── server.js           # Express服务器
├── package.json        # 服务器依赖
├── package-lock.json   # 依赖锁定文件
├── .env.example        # 环境变量模板
└── README.md           # 服务器说明文档
```

### 配置和工具文件
```
├── .env.example        # 环境变量模板
├── .vercelignore       # Vercel忽略文件
├── .vscode/            # VS Code配置
├── .trae/              # TRAE AI配置
│   └── documents/      # 项目文档
├── start-tts-server.sh # TTS服务器启动脚本
├── vercel.json         # Vercel 配置文件
├── tailwind.config.js  # Tailwind CSS 配置
├── vite.config.ts      # Vite 配置文件
├── tsconfig.json       # TypeScript 配置
├── tsconfig.app.json   # 应用TypeScript配置
├── eslint.config.js    # ESLint 配置
├── postcss.config.js   # PostCSS 配置
├── package.json        # 项目依赖配置
├── pnpm-lock.yaml      # pnpm 锁定文件
├── index.html          # HTML 入口文件
└── public/             # 公共静态资源
    └── favicon.svg     # 网站图标
```

## 🔒 隐私与安全

- **本地存储**: 所有用户数据和配置都存储在浏览器本地
- **API密钥安全**: LLM API 密钥仅在客户端使用，TTS API 密钥通过后端代理保护
- **无数据收集**: 应用不收集任何用户数据或使用统计
- **开源透明**: 完全开源，代码公开透明
- **安全验证**: TTS API 包含密钥验证机制，防止未授权访问
- **HTTPS 通信**: 所有 API 通信都使用 HTTPS 加密
- **环境变量保护**: 敏感信息通过环境变量管理，不会暴露在代码中

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 🆘 获取帮助

如果遇到问题：

1. 查看 [Vercel 官方文档](https://vercel.com/docs)
2. 检查 [Fish Audio API 文档](https://docs.fish.audio/)
3. 查看项目的 GitHub Issues
4. 联系技术支持

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [React](https://reactjs.org/) - 用户界面库
- [Vite](https://vitejs.dev/) - 快速的构建工具
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的CSS框架
- [DaisyUI](https://daisyui.com/) - 基于 Tailwind 的组件库
- [Zustand](https://github.com/pmndrs/zustand) - 轻量级状态管理
- [React Router](https://reactrouter.com/) - 声明式路由
- [Sonner](https://sonner.emilkowal.ski/) - 优雅的通知组件
- [Lucide](https://lucide.dev/) - 美观的图标库
- [Fish Audio](https://fish.audio/) - 高质量语音合成服务
- [TRAE SOLO](https://trae.ai/) - AI 开发工具

---

**开始你的AI聊天之旅吧！** 🚀
