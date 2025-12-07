# Floaty Bub 🫧

[中文](#中文) | [English](#english)

<a name="中文"></a>

一个基于 React + TypeScript + Capacitor 的现代化智能对话助手应用，集成了多角色对话、知识库管理、语音交互、数据同步等丰富功能。支持 Web 端及 iOS 移动端原生体验。

> 使用 [TRAE SOLO](https://trae.ai) 开发
>
> [查看 Web Demo](https://floatybub.vercel.app/)

## ✨ 功能特性

### 🎯 核心功能
- **多模型支持**: 支持 Kimi、Moonshot、OpenAI、Claude、Gemini 等主流大语言模型
- **流式响应**: 实时显示 AI 回复，支持流式文本和图片生成
- **智能角色系统**: 支持自定义 AI 角色、系统提示词和个性化开场白
- **知识库管理**: 完整的知识库 CRUD、条目管理、批量导入、智能搜索 (RAG)
- **用户认证系统**: 基于 Supabase 的完整用户管理和数据隔离
- **数据同步**: 云端实时同步、离线支持、多设备无缝切换
- **全局提示词**: 可复用的提示词模板，支持拖拽排序
- **语音功能**: 集成 Fish Audio TTS，支持文本转语音和音频可视化
- **会话管理**: 完整的聊天历史记录、会话搜索和分类管理
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
- Supabase 项目 (用于数据同步)
- Fish Audio API 密钥 (可选，用于语音功能)

### 安装依赖
```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install
```

### 启动 Web 开发服务器
```bash
npm run dev
```
访问 [http://localhost:5173](http://localhost:5173) 查看应用。

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
- **Knowledge Base**: Full RAG support with CRUD, bulk import, and intelligent search.
- **Authentication**: Complete user management and data isolation based on Supabase.
- **Data Sync**: Real-time cloud sync, offline support, and seamless multi-device switching.
- **Global Prompts**: Reusable prompt templates with drag-and-drop sorting.
- **Voice Interaction**: Integrated Fish Audio TTS for text-to-speech and audio visualization.
- **Chat Management**: Complete chat history, search, and categorization.
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
- Supabase Project (For data sync)
- Fish Audio API Key (Optional, for voice features)

### Installation
```bash
# Using pnpm (Recommended)
pnpm install

# Or using npm
npm install
```

### Start Web Development Server
```bash
npm run dev
```
Visit [http://localhost:5173](http://localhost:5173).

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
