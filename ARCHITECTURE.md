# 项目代码规范与架构文档 (Architecture & Code Standards)

## 1. 技术栈概览 (Tech Stack)

*   **核心框架**: React 18 + TypeScript + Vite
*   **移动端适配**: Capacitor (主要针对 iOS)
*   **状态管理**: Zustand (支持 IndexedDB 持久化)
*   **样式方案**: Tailwind CSS 4 + DaisyUI 5 (CSS Variables 主题配置)
*   **后端/数据库**: Supabase (PostgreSQL, Auth, Realtime, Storage)
*   **路由**: React Router DOM
*   **图标库**: Lucide React
*   **动画/手势**: React Spring + React Use Gesture

## 2. 目录结构 (Directory Structure)

采用 **功能模块化** 与 **类型分层** 相结合的结构：

```text
src/
├── assets/             # 静态资源 (Images, SVGs)
├── components/         # 通用 UI 组件
│   ├── auth/           # 特定业务领域的组件 (如登录注册)
│   ├── navigation/     # 导航相关组件
│   └── [Component].tsx # 原子/分子级通用组件
├── hooks/              # 自定义 React Hooks (useAuth, useUserData 等)
├── lib/                # 第三方库配置与封装 (supabase.ts, utils.ts)
├── router/             # 路由配置
├── screens/            # 页面级组件 (Views)
│   ├── chats/          # 聊天功能模块
│   ├── settings/       # 设置模块 (包含 Desktop/Mobile 不同视图)
│   └── _debug/         # 开发调试用页面 (生产环境应排除或隐藏)
├── services/           # 业务逻辑服务层 (非 Hook 的纯逻辑，如 StorageService)
├── store/              # 全局状态管理 (Zustand stores)
├── types/              # 全局类型定义
├── utils/              # 工具函数
└── wasm/               # WebAssembly 模块 (如分词器)
```

## 3. 命名规范 (Naming Conventions)

*   **文件与文件夹**:
    *   **React 组件**: `PascalCase` (如 `UserAvatar.tsx`, `SettingsModal.tsx`)
    *   **Hooks**: `camelCase` 且以 `use` 开头 (如 `useAuth.ts`)
    *   **工具/服务/配置**: `camelCase` (如 `supabase.ts`, `dataSyncService.ts`, `storage.ts`)
*   **代码标识符**:
    *   **组件名**: `PascalCase`，与文件名保持一致。
    *   **接口/类型**: `PascalCase` (如 `UserAvatarProps`, `AuthState`)。
    *   **变量/函数**: `camelCase`。
    *   **常量**: `UPPER_SNAKE_CASE` (如 `SNOWFLAKE_ID_PREFIX`)。
    *   **CSS 类**: 使用 Tailwind 实用类，尽量避免自定义 BEM，除特定动画或复杂选择器外。

## 4. 编码规范与模式 (Coding Patterns)

### 4.1 React 组件
*   **函数式组件**: 全部使用 Functional Components + Hooks。
*   **Props 定义**: 使用 `interface` 定义 Props，并优先解构 Props。
*   **导出**: 优先使用 `export function ComponentName` 而非 `export default` (便于重构和自动导入)。
    *   *例外*: 懒加载页面 (`React.lazy`) 可能需要 default export。

```tsx
// 推荐
export interface MyComponentProps {
  isVisible: boolean;
}

export function MyComponent({ isVisible }: MyComponentProps) {
  return <div>...</div>;
}
```

### 4.2 状态管理 (Zustand)
*   **Store 分割**: 按领域分割 Store (如 `useAppStore`, `useKnowledgeStore`)。
*   **持久化**:
    *   使用 `indexedDBStorage` 替代 `localStorage` 以支持大容量数据。
    *   **关键**: 涉及 `snowflake_id` (大整数) 的字段，必须使用自定义序列化器 (`customSerializer`) 处理，防止 JS 精度丢失。

### 4.3 数据库与 API (Supabase)
*   **类型安全**: 必须使用 `src/lib/supabase.ts` 导出的 `Database` 类型生成强类型客户端。
*   **RLS 策略**: 所有数据访问必须通过 RLS (Row Level Security) 控制，禁止前端直接使用 `service_role` key。
*   **API 调用**: 优先封装在 `services/` 层或 `hooks/` 中，避免在组件内直接写大量 `supabase.from(...).select(...)`。

### 4.4 样式 (Tailwind + DaisyUI)
*   **工具类优先**: 尽量使用 Tailwind 类名。
*   **主题变量**: 颜色和全局样式在 `src/index.css` 中通过 CSS 变量配置 (DaisyUI 插件)。
*   **动态样式**: 使用 `clsx` 或 `tailwind-merge` 处理条件类名。

```tsx
import { cn } from '@/lib/utils'; // 假设有封装 clsx + twMerge

<div className={cn("p-4 bg-base-100", isActive && "text-primary")} />
```

### 4.5 路径引用
*   **别名引用**: 配置了 `@/*` 指向 `src/*`，建议优先使用别名引用，减少 `../../../` 层级地狱。

## 5. 特殊处理与注意事项

*   **Snowflake ID**: 项目使用了雪花算法生成 ID。由于 JS `Number` 精度限制，前端必须将其视为 **字符串** 处理。在序列化/反序列化时需格外小心。
*   **移动端优化**:
    *   利用 `safe-area-inset-*` 环境变量适配刘海屏。
    *   使用 `touch-action: none` 或特定手势库处理 iOS 橡皮筋效果。
*   **调试**: `src/screens/_debug/` 下存放了调试页面，生产环境构建时应注意剥离或权限控制。

## 6. Git 提交规范

建议遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

*   `feat`: 新功能
*   `fix`: 修复 Bug
*   `refactor`: 代码重构 (无新功能或 Bug 修复)
*   `style`: 格式化、样式调整
*   `chore`: 构建过程或辅助工具的变动
*   `docs`: 文档变更
