# Floaty Bub 🫧

[中文](#中文) | [English](#english)

<a name="中文"></a>

一个基于 React + TypeScript + Capacitor 的现代化智能对话助手应用，集成了多角色对话、知识库管理、技能库、语音交互、数据同步等丰富功能。支持 Web 端及 iOS 移动端原生体验。

> 使用 [TRAE SOLO](https://trae.ai) 开发
>
> [查看 Web Demo](https://floatybub.vercel.app/)

## ✨ 功能特性

### 🎯 核心功能
- **多模型支持**: 支持 Kimi、Moonshot、OpenAI、Claude、Gemini 等主流大语言模型
- **流式响应**: 实时显示 AI 回复，支持流式文本和图片生成
- **智能角色系统**: 支持自定义 AI 角色、系统提示词和个性化开场白
- **技能系统 (Agent Skills)**: 为角色/会话挂载技能说明与附带文件，支持会话内启用并持久化
- **知识库管理**: 完整的知识库 CRUD、条目管理、批量导入、智能搜索 (RAG)
- **联网搜索**: 可选 Google CSE 联网检索，通过 Serverless 接口转发与鉴权
- **用户认证系统**: 基于 Supabase 的完整用户管理和数据隔离
- **数据同步**: 云端实时同步、离线支持、多设备无缝切换
- **全局提示词**: 可复用的提示词模板，支持拖拽排序
- **语音功能**: 集成 Fish Audio TTS，支持文本转语音和音频可视化
- **会话管理**: 完整的聊天历史记录、会话搜索和分类管理
- **多云存储**: 支持 AWS S3 / Aliyun OSS / Tencent COS，用于上传与管理文件资源
- **跨平台支持**: 完美适配桌面端、移动端 Web，并提供 iOS 原生应用体验

### 🎨 用户体验
- **现代化界面**: 基于 DaisyUI 5.0 的精美设计系统
- **多主题支持**: 支持亮色、深色、纸杯蛋糕、浮光等多种主题
- **输入体验优化**: 针对移动端的输入框防遮挡、防自动填充干扰优化
- **智能通知**: 优雅的 Toast 通知系统
- **数据持久化**: 本地存储 + 云端同步，数据安全可靠

### 🔧 技术特色
- **TypeScript**: 完整的类型安全保障
- **组件化架构**: 高度模块化和可维护的代码结构
- **移动端原生**: 使用 Capacitor 将 Web 应用打包为 iOS 原生应用
- **状态管理**: 基于 Zustand 5.0 的轻量级状态管理
- **实时通信**: Server-Sent Events 实现流式数据传输
- **数据库集成**: Supabase 实时数据库，支持 RLS 权限控制
- **智能搜索**: 基于 jieba-wasm 的中文分词和关键词匹配
- **Markdown 渲染**: 支持代码高亮和 GitHub 风格的 Markdown

## 🛠️ 技术栈

- **前端框架**: React 18.3 + TypeScript 5.8
- **移动端框架**: Capacitor 7.4 (iOS)
- **构建工具**: Vite 6.3
- **样式方案**: Tailwind CSS 4.1 + DaisyUI 5.0
- **状态管理**: Zustand 5.0
- **路由管理**: React Router DOM 7.3
- **后端/数据库**: Supabase (PostgreSQL + Auth + Realtime)
- **云存储**: AWS S3 兼容协议 (支持 AWS, Aliyun OSS, Tencent COS)
- **工具库**: 
  - `jieba-wasm`: 中文分词
  - `lucide-react`: 图标库
  - `react-markdown`: Markdown 渲染
  - `framer-motion` / `@react-spring/web`: 动画

## 🚀 快速开始

### 环境要求
- Node.js 22.x (推荐)
- pnpm 或 npm
- Xcode (仅 iOS 开发需要)
- Supabase 项目 (用于认证与数据同步)
- Fish Audio API 密钥 (可选，用于语音功能)

### 正确启动项目

本项目由三个运行部分组成：

| 部分 | 默认地址 | 用途 | 本地开发是否需要 |
| --- | --- | --- | --- |
| Vite 前端 | `http://localhost:5173` | Web 页面 | 必需 |
| `local-server` | `http://localhost:3001` | 本地 TTS、联网搜索等代理接口 | 完整功能需要 |
| Vercel Serverless | `https://floatybub.vercel.app` | Fish Agent 会话和 Floaty LLM Gateway | 实时通话需要 |

#### 1. 安装依赖

```bash
npm install
npm --prefix local-server install
```

也可以在根目录使用 `pnpm install`，但 `local-server` 是独立的 npm 项目，仍需单独安装其依赖。

#### 2. 配置本地环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，至少提供：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# 本地测试实时通话时，使用已经部署并配置好的 Vercel 后端
VITE_VOICE_API_BASE_URL=https://floatybub.vercel.app
```

如需本地 TTS 或联网搜索，再复制并配置本地服务环境：

```bash
cp local-server/.env.example local-server/.env
```

不要把 Fish Audio 或 LLM 的服务端私钥放在 `VITE_` 开头的变量中；Vite 会把这类变量打包到浏览器。当前存储功能使用的 `VITE_STORAGE_*` 凭据也会暴露给客户端，只应使用权限受限的测试凭据。仓库已有本地 `.env` 时，不要用示例文件覆盖其中的有效配置。

#### 3. 启动本地代理

在第一个终端运行：

```bash
npm run voice:server
```

看到 `本地代理服务运行在 http://localhost:3001` 后再启动前端。开发模式下，普通 API 会固定访问这个地址。

#### 4. 启动 Web 前端

在第二个终端运行：

```bash
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。首次使用需登录 Supabase 账号。

#### 5. 验证启动结果

- Web 页面：访问 `http://localhost:5173`
- 本地代理健康检查：访问 `http://localhost:3001/api/health`
- 实时通话测试页：访问 `http://localhost:5173/call/pilot`
- Vercel 语音服务状态：访问 `https://floatybub.vercel.app/api/voice-session`

通话测试页需要选择已同步到 Supabase 的 Floaty Agent 和受支持的 LLM 配置。通话链路为 `浏览器 → Fish Audio → Floaty LLM Gateway → 所选 LLM`。通话模式当前不加载 Skill 和知识库。

如果只开发界面，可以只运行 `npm run dev`；此时依赖 `/api/*` 的 TTS、搜索等本地功能不可用。实时通话仍可使用，前提是 `.env.local` 中的 `VITE_VOICE_API_BASE_URL` 指向可用的 Vercel 部署。

### 环境变量配置
本项目同时包含前端与 Serverless 接口能力，建议使用 `.env.local` 管理本地环境变量（不会提交到仓库）。

1. **创建环境变量文件**
   ```bash
   cp .env.example .env.local
   ```

2. **配置 Supabase（必填）**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **配置联网搜索 / 后端接口鉴权（可选）**
   - `VITE_API_SECRET`：前端请求时通过 `x-api-key` 传给后端
   - `API_SECRET`：Serverless 校验 `x-api-key`
   - `GOOGLE_SEARCH_API_KEY`、`GOOGLE_SEARCH_CX`：用于 `/api/search`（推荐配置在服务端）

4. **配置生产环境 API 基址（部署时必填）**
   - `VITE_API_BASE_URL`：指向你的部署域名（例如 Vercel）

> 提示：更多配置示例见 [.env.example](./.env.example)；本地代理服务配置见 [local-server/.env.example](./local-server/.env.example)。

### Serverless API（部署到 Vercel）
项目根目录的 `api/` 提供 Serverless Functions：
- `/api/tts`：TTS 转发与流式输出
- `/api/search`：Google CSE 联网搜索
- `/api/voice-session`：校验用户并创建 Fish Audio 私有会话
- `/api/llm-gateway`（对外兼容 `/v1/chat/completions`）：将 Fish Audio 的对话请求路由到本次会话选择的 LLM
- `/api/health`、`/api/models`、`/api/model-info`、`/api/validate-key`：诊断与辅助接口

### 本地运行代理服务（可选）
如果你希望在本地运行代理服务（TTS / 联网搜索 等），可使用 `local-server/`：
```bash
cd local-server && npm run dev
```

### iOS 开发与构建
本项目支持通过 Capacitor 构建 iOS 应用。

1. **构建前端资源**
   ```bash
   npm run build
   ```

2. **同步资源到 iOS 项目**
   ```bash
   npx cap sync
   # 或者使用 npm 脚本
   npm run cap:sync
   ```

3. **打开 Xcode 进行调试/打包**
   ```bash
   npx cap open ios
   # 或者使用 npm 脚本
   npm run cap:open:ios
   ```

---

<a name="english"></a>

# Floaty Bub 🫧

A modern intelligent dialogue assistant based on React + TypeScript + Capacitor, integrating multi-role dialogue, knowledge base management, voice interaction, and data synchronization. Supports both Web and native iOS experiences.

> Developed with [TRAE SOLO](https://trae.ai)
>
> [View Web Demo](https://floatybub.vercel.app/)

## ✨ Features

### 🎯 Core Features
- **Multi-Model Support**: Supports mainstream LLMs like Kimi, Moonshot, OpenAI, Claude, Gemini, etc.
- **Streaming Response**: Real-time AI response display with streaming text and image generation.
- **Smart Persona System**: Custom AI personas, system prompts, and personalized greetings.
- **Agent Skills**: Attach skill instructions and files to roles/sessions, enable per session with persistence.
- **Knowledge Base**: Full RAG support with CRUD, bulk import, and intelligent search.
- **Web Search**: Optional Google CSE search via authenticated Serverless API.
- **Authentication**: Complete user management and data isolation based on Supabase.
- **Data Sync**: Real-time cloud sync, offline support, and seamless multi-device switching.
- **Global Prompts**: Reusable prompt templates with drag-and-drop sorting.
- **Voice Interaction**: Integrated Fish Audio TTS for text-to-speech and audio visualization.
- **Chat Management**: Complete chat history, search, and categorization.
- **Multi-Cloud Storage**: AWS S3 / Aliyun OSS / Tencent COS adapters for file storage.
- **Cross-Platform**: Responsive design for Desktop/Web and native iOS support via Capacitor.

### 🎨 User Experience
- **Modern UI**: Beautiful design system based on DaisyUI 5.0.
- **Theming**: Supports Light, Dark, Cupcake, Synthwave, and more.
- **Optimized Input**: Enhanced input handling for mobile (preventing autofill interference).
- **Smart Notifications**: Elegant Toast notification system.
- **Persistence**: Local storage + Cloud sync for data reliability.

### 🔧 Technical Highlights
- **TypeScript**: Complete type safety.
- **Component Architecture**: Highly modular and maintainable code.
- **Native Mobile**: Capacitor for packaging Web app as native iOS app.
- **State Management**: Lightweight state management with Zustand 5.0.
- **Real-time Communication**: Server-Sent Events for streaming data.
- **Database**: Supabase Realtime database with RLS.
- **Smart Search**: Chinese word segmentation via jieba-wasm.
- **Markdown**: Code highlighting and GitHub-flavored Markdown support.

## 🛠️ Tech Stack

- **Frontend**: React 18.3 + TypeScript 5.8
- **Mobile**: Capacitor 7.4 (iOS)
- **Build Tool**: Vite 6.3
- **Styling**: Tailwind CSS 4.1 + DaisyUI 5.0
- **State Management**: Zustand 5.0
- **Routing**: React Router DOM 7.3
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime)
- **Storage**: AWS S3 Compatible (AWS, Aliyun OSS, Tencent COS)
- **Utilities**: 
  - `jieba-wasm`: Word segmentation
  - `lucide-react`: Icons
  - `react-markdown`: Rendering
  - `framer-motion` / `@react-spring/web`: Animations

## 🚀 Quick Start

### Prerequisites
- Node.js 22.x (Recommended)
- pnpm or npm
- Xcode (For iOS development only)
- Supabase Project (For auth and data sync)
- Fish Audio API Key (Optional, for voice features)

### Start the project correctly

The project has three runtime parts:

| Part | Default URL | Purpose | Required locally |
| --- | --- | --- | --- |
| Vite frontend | `http://localhost:5173` | Web UI | Yes |
| `local-server` | `http://localhost:3001` | Local TTS and search proxy APIs | For the full feature set |
| Vercel Serverless | `https://floatybub.vercel.app` | Fish sessions and the Floaty LLM Gateway | For realtime calls |

#### 1. Install dependencies

```bash
npm install
npm --prefix local-server install
```

You can use `pnpm install` in the repository root, but `local-server` is a separate npm project and its dependencies must still be installed separately.

#### 2. Configure local environment variables

```bash
cp .env.example .env.local
```

At minimum, set these values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VOICE_API_BASE_URL=https://floatybub.vercel.app
```

For local TTS and web search, also configure the local proxy:

```bash
cp local-server/.env.example local-server/.env
```

Do not put Fish Audio or LLM server secrets in variables prefixed with `VITE_`; Vite exposes those variables to the browser. The current `VITE_STORAGE_*` credentials are also client-visible and should be limited test credentials. Do not overwrite an existing configured `.env` file with the example.

#### 3. Start the local proxy

Run in the first terminal:

```bash
npm run voice:server
```

Wait for `http://localhost:3001` to be ready. In development, regular API requests use this address.

#### 4. Start the frontend

Run in a second terminal:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with a Supabase account.

#### 5. Verify the services

- Web UI: `http://localhost:5173`
- Local proxy health: `http://localhost:3001/api/health`
- Realtime call pilot: `http://localhost:5173/call/pilot`
- Vercel voice health: `https://floatybub.vercel.app/api/voice-session`

The call pilot requires a Floaty Agent and a supported LLM configuration synced to Supabase. Its request path is `browser → Fish Audio → Floaty LLM Gateway → selected LLM`. Call mode currently excludes Skills and knowledge bases.

For UI-only work, running `npm run dev` is enough. Local features that call `/api/*`, such as TTS and search, will be unavailable unless `local-server` is running. Realtime calls can still work when `VITE_VOICE_API_BASE_URL` points to a working Vercel deployment.

### Environment Variables
Use `.env.local` for local development (not committed).

1. **Create `.env.local`**
   ```bash
   cp .env.example .env.local
   ```

2. **Supabase (Required)**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Search / API Auth (Optional)**
   - `VITE_API_SECRET` (sent as `x-api-key`)
   - `API_SECRET` (validated by Serverless functions)
   - `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX` for `/api/search` (recommended on server)

4. **API Base URL for Production (Required when deployed)**
   - `VITE_API_BASE_URL` (your deployed domain, e.g. Vercel)

> See [.env.example](./.env.example) and [local-server/.env.example](./local-server/.env.example) for examples.

### Serverless API (Vercel)
Serverless functions in `api/`:
- `/api/tts` (TTS proxy with streaming output)
- `/api/search` (Google CSE web search)
- `/api/voice-session` (authenticated Fish Audio private sessions)
- `/api/llm-gateway`, exposed as `/v1/chat/completions` (routes Fish Audio turns to the LLM selected for the session)
- `/api/health`, `/api/models`, `/api/model-info`, `/api/validate-key` (diagnostics)

### Run Local Proxy Server (Optional)
To run the local proxy server (TTS / web search, etc.) without relying on a deployed backend:
```bash
cd local-server && npm run dev
```

### iOS Development & Build
This project supports building for iOS via Capacitor.

1. **Build Frontend Assets**
   ```bash
   npm run build
   ```

2. **Sync Assets to iOS Project**
   ```bash
   npx cap sync
   # Or use the script
   npm run cap:sync
   ```

3. **Open Xcode**
   ```bash
   npx cap open ios
   # Or use the script
   npm run cap:open:ios
   ```
