# AI聊天工具 🤖

一个现代化的AI聊天工具，支持多种大语言模型，提供流畅的对话体验和丰富的自定义功能。

## ✨ 功能特性

### 🎯 核心功能
- **多模型支持**: 支持 OpenAI GPT、Claude、Gemini、通义千问等主流大语言模型
- **流式输出**: 实时显示AI回复，提供流畅的对话体验
- **智能角色系统**: 支持自定义AI角色、系统提示词和个性化开场白
- **全局提示词**: 可复用的提示词模板，提升对话质量
- **会话管理**: 完整的聊天历史记录、会话搜索和分类管理
- **配置管理**: 灵活的模型配置和API密钥管理
- **数据导入导出**: 支持完整的数据备份和迁移

### 🎨 用户体验
- **现代化界面**: 基于 DaisyUI 的精美设计系统
- **丰富主题**: 支持 35+ 内置主题，满足个性化需求
- **响应式设计**: 完美适配桌面端和移动端，优化移动端交互
- **友好交互**: 优雅的确认对话框、空状态提示和状态反馈
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
- **样式方案**: Tailwind CSS + DaisyUI
- **状态管理**: Zustand
- **路由管理**: React Router 7
- **图标库**: Lucide React
- **通知组件**: Sonner
- **Markdown**: React Markdown + Rehype Highlight
- **代码高亮**: Highlight.js
- **部署平台**: Vercel

## 🚀 快速开始

### 环境要求
- Node.js 18.0+
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
1. 点击侧边栏的"模型配置"菜单
2. 添加新的模型配置
3. 填写API密钥、基础URL等信息
4. 保存配置

### 2. 创建AI角色
1. 进入"AI角色"页面
2. 点击"添加角色"按钮
3. 设置角色名称、描述、系统提示词和开场白
4. 可选择关联全局提示词模板
5. 上传自定义头像（可选）
6. 保存角色设置

### 3. 开始聊天
1. 在首页选择AI角色
2. 系统会自动显示角色的开场白
3. 开始与AI对话
4. 支持实时流式回复和 Markdown 渲染

### 4. 管理会话
- 在"聊天历史"页面查看所有会话
- 支持按角色、模型、时间筛选会话
- 支持会话搜索和导出
- 点击会话可以继续对话
- 支持置顶和删除会话

## 🌐 部署到Vercel

### 一键部署
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/ai-chat-tool)

### 手动部署
1. Fork 本仓库
2. 在 Vercel 中导入项目
3. 配置构建设置（通常自动检测）
4. 部署完成

### 环境变量配置
由于本项目采用纯前端架构，所有配置都在客户端完成，无需设置服务器端环境变量。用户的API密钥等敏感信息都安全地存储在浏览器本地存储中。

## 📁 项目结构

```
src/
├── components/          # 可复用组件
│   ├── Layout.tsx      # 应用布局组件
│   ├── Avatar.tsx      # 头像组件
│   ├── AvatarUpload.tsx # 头像上传组件
│   ├── ChatSessionList.tsx # 聊天会话列表
│   ├── ConfirmDialog.tsx # 确认对话框组件
│   ├── EmptyState.tsx  # 空状态组件
│   ├── MarkdownRenderer.tsx # Markdown渲染器
│   ├── Popconfirm.tsx  # 弹出确认组件
│   └── RoleSelector.tsx # 角色选择器
├── pages/              # 页面组件
│   ├── Home.tsx        # 首页
│   ├── ChatPage.tsx    # 聊天页面
│   ├── ConfigPage.tsx  # 模型配置页面
│   ├── RolesPage.tsx   # AI角色管理页面
│   ├── GlobalPromptsPage.tsx # 全局提示词页面
│   ├── HistoryPage.tsx # 聊天历史页面
│   ├── DataPage.tsx    # 数据管理页面
│   └── SettingsPage.tsx # 设置页面
├── store/              # 状态管理
│   └── index.ts        # Zustand store
├── hooks/              # 自定义Hooks
│   └── useTheme.ts     # 主题管理Hook
├── utils/              # 工具函数
│   └── avatarUtils.ts  # 头像工具函数
├── router/             # 路由配置
│   └── index.tsx       # 路由定义
└── lib/                # 工具函数
    └── utils.ts        # 通用工具函数
```

## 🔒 隐私与安全

- **本地存储**: 所有用户数据和配置都存储在浏览器本地
- **API密钥安全**: 密钥仅在客户端使用，不会发送到第三方服务器
- **无数据收集**: 应用不收集任何用户数据或使用统计
- **开源透明**: 完全开源，代码公开透明

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [React](https://reactjs.org/) - 用户界面库
- [Vite](https://vitejs.dev/) - 快速的构建工具
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的CSS框架
- [Zustand](https://github.com/pmndrs/zustand) - 轻量级状态管理
- [Lucide](https://lucide.dev/) - 美观的图标库

---

**开始你的AI聊天之旅吧！** 🚀
