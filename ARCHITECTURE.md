# 项目代码规范与架构文档 (Architecture & Code Standards)

本文档旨在统一项目技术架构与代码规范，确保代码的可维护性、扩展性与健壮性。

## 1. 技术栈概览 (Tech Stack)

*   **核心框架**: React 18 + TypeScript + Vite
*   **移动端适配**: Capacitor (主要针对 iOS)
*   **状态管理**: Zustand (支持 IndexedDB 持久化)
*   **样式方案**: Tailwind CSS 4 + DaisyUI 5 (CSS Variables 主题配置)
*   **后端/数据库**: Supabase (PostgreSQL, Auth, Realtime, Storage)
*   **路由**: React Router DOM
*   **图标库**: Lucide React
*   **动画/手势**: React Spring + React Use Gesture
*   **本地存储**: IndexedDB (自定义封装 `src/store/storage.ts`)

## 2. 核心架构模式 (Core Architecture Patterns)

### 2.1 Local-First (本地优先策略)
项目采用 **"Local-First, Cloud-Sync"** 的架构策略，以提升用户体验（无加载延迟）并支持离线使用。

*   **读取流程**: UI 组件 -> Zustand Store -> IndexedDB (立即渲染) -> 后台触发 Cloud Pull -> 更新 Store & IndexedDB。
*   **写入流程**: UI 操作 -> 更新 Store & IndexedDB -> 添加同步任务到队列 -> 后台 DataSyncService 推送至 Cloud。
*   **数据隔离**: 敏感数据（如知识库、会话）在 IndexedDB 中按 `user_id` 进行 Key 隔离 (e.g. `knowledge:bases:{userId}`).

### 2.2 服务层 (Service Layer)
复杂业务逻辑封装在 `src/services/` 目录，避免组件臃肿。

*   **KnowledgeService**: 处理知识库的 CRUD、缓存策略、用户 Scope 切换。
*   **DataSyncService**: 处理离线同步队列、网络状态监听、冲突解决。
*   **StorageService**: 处理文件上传，采用适配器模式支持多云存储 (Aliyun OSS, AWS S3, Tencent COS)。

### 2.3 认证与会话 (Authentication)
*   **useAuth Hook**: 负责用户登录状态管理。
*   **健壮性**: 包含离线检测、自动重试机制 (Exponential Backoff)、Session 恢复逻辑。
*   **数据保留**: 登出时仅清除 Auth Token，保留本地业务数据（知识库、角色卡等），以优化重新登录体验。

## 3. 目录结构 (Directory Structure)

采用 **功能模块化** 与 **类型分层** 相结合的结构：

```text
src/
├── assets/             # 静态资源 (Images, SVGs)
├── components/         # 通用 UI 组件
│   ├── auth/           # 认证相关组件
│   ├── navigation/     # 导航组件
│   └── [Component].tsx # 原子/分子级通用组件
├── hooks/              # 自定义 React Hooks (useAuth, useUserData)
├── lib/                # 第三方库封装 (supabase.ts, utils.ts)
├── router/             # 路由配置
├── screens/            # 页面级组件 (Views)
│   ├── chats/          # 聊天模块
│   ├── settings/       # 设置模块 (分 Desktop/Mobile 视图)
│   └── _debug/         # 开发调试页面
├── services/           # 业务逻辑服务层 (纯逻辑，无 UI)
│   ├── storage/        # 文件存储服务及适配器
│   ├── DataSyncService.ts  # 数据同步服务
│   └── knowledgeService.ts # 知识库服务
├── store/              # 全局状态管理 (Zustand stores)
│   ├── knowledgeStore.ts
│   └── storage.ts      # IndexedDB 适配器
├── types/              # 全局类型定义
├── utils/              # 工具函数
└── wasm/               # WebAssembly 模块
```

## 4. 命名规范 (Naming Conventions)

*   **文件与文件夹**:
    *   **React 组件**: `PascalCase` (e.g., `UserAvatar.tsx`)
    *   **Hooks**: `camelCase` 且以 `use` 开头 (e.g., `useAuth.ts`)
    *   **服务类 (Classes)**: `PascalCase` (e.g., `DataSyncService.ts`)
    *   **工具/实例 (Instances)**: `camelCase` (e.g., `knowledgeService.ts`, `supabase.ts`)
*   **代码标识符**:
    *   **组件名**: `PascalCase`
    *   **接口/类型**: `PascalCase` (e.g., `AuthState`)
    *   **变量/函数**: `camelCase`
    *   **常量**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)

## 5. 编码规范 (Coding Standards)

### 5.1 React 组件
*   **函数式组件**: 全部使用 Functional Components + Hooks。
*   **Props**: 使用 `interface` 定义，优先解构。
*   **导出**: 优先使用 Named Export (`export function Component...`)。

### 5.2 状态管理 (Zustand)
*   **Store 设计**: 按领域拆分 Store。
*   **异步操作**: Action 内部处理 try-catch，并管理 loading/error 状态。
*   **持久化**: 使用 `persist` 中间件配合 `src/store/storage.ts` 的 `indexedDBStorage`。

### 5.3 数据库与 API
*   **类型安全**: 严格使用 Supabase 生成的 `Database` 类型。
*   **RLS**: 必须依赖后端 Row Level Security，前端禁止使用 Service Role Key。
*   **批量操作**: 列表查询应分页或限制数量，避免全量拉取。

### 5.4 样式
*   **Tailwind**: 优先使用 Utility Classes。
*   **动态类名**: 使用 `clsx` 或 `tailwind-merge` (项目中封装为 `cn` 函数)。
*   **主题**: 通过 CSS 变量适配深色/浅色模式。

### 5.5 路径引用与别名
*   **别名优先**: 严禁使用 `../../` 类型的相对路径引用，必须使用 `@/` 别名。
    *   ✅ `import { Button } from '@/components/ui/button'`
    *   ❌ `import { Button } from '../../../components/ui/button'`
*   **同级引用**: 仅当引用同级目录下的文件时，允许使用 `./`。

## 6. 数据存储策略 (Storage Strategy)

### 6.1 IndexedDB (本地)
*   **封装**: 使用 `src/store/storage.ts` 提供的 `indexedDBStorage`。
*   **迁移**: 内置了从 `localStorage` 到 `IndexedDB` 的自动迁移逻辑。
*   **容量**: 适合存储大量文本（聊天记录、知识库）、Base64 图片缓存。

### 6.2 Cloud Storage (文件)
*   **适配器模式**: 支持阿里云 OSS、AWS S3、腾讯云 COS。
*   **配置**: 通过 `Settings` -> `Storage` 动态配置，配置加密存储在本地。

## 7. Git 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

*   `feat`: 新功能
*   `fix`: 修复 Bug
*   `refactor`: 代码重构
*   `perf`: 性能优化
*   `chore`: 构建/工具变动
*   `docs`: 文档变更

---
**注意**: 在涉及代码增删改时，请务必参考本文档，保持项目结构的一致性。
