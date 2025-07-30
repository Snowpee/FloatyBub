# TTS API 安全配置指南

## 概述

为了保护 TTS API 免受未授权访问，我们已经实现了 API 密钥验证机制。所有 API 请求都需要在请求头中包含有效的 API 密钥。

## 环境变量配置

### 1. 本地开发环境

在项目根目录创建 `.env` 文件：

```bash
# 前端 API 密钥（用于调用后端 API）
VITE_API_SECRET=your-secret-api-key-here

# Fish Audio API 密钥
FISH_AUDIO_API_KEY=your-fish-audio-api-key-here
```

### 2. TTS 服务器环境

在 `tts-server` 目录创建 `.env` 文件：

```bash
# Fish Audio API 配置
FISH_AUDIO_API_KEY=your_fish_audio_api_key_here

# API 安全配置
API_SECRET=your_secret_api_key_here

# 服务器配置
PORT=3001
```

### 3. Vercel 部署环境

在 Vercel 项目设置中配置以下环境变量：

- `API_SECRET`: 用于验证 API 访问的密钥
- `FISH_AUDIO_API_KEY`: Fish Audio 平台的 API 密钥
- `VITE_API_SECRET`: 前端 API 密钥（用于调用后端 API）

## API 使用方式

### 请求头格式

所有 API 请求都必须包含以下请求头：

```javascript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': 'your-api-key-here'
}
```

### 受保护的端点

以下端点需要 API 密钥验证：

- `GET /api/tts` - 获取支持的模型列表
- `POST /api/tts` - 文本转语音
- `GET /api/health` - 健康检查

## 安全建议

### 1. API 密钥管理

- 使用强密码生成器创建复杂的 API 密钥
- 定期轮换 API 密钥
- 不要在代码中硬编码 API 密钥
- 不要将 `.env` 文件提交到版本控制系统

### 2. 生产环境安全

- 在 Vercel 环境变量中设置 API 密钥
- 考虑实现请求频率限制
- 监控 API 使用情况
- 记录访问日志

### 3. 网络安全

- 使用 HTTPS 进行所有 API 通信
- 考虑实现 IP 白名单（如果适用）
- 定期审查访问日志

## 错误处理

### 常见错误响应

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

## 故障排除

### 1. 本地开发问题

- 确保 `.env` 文件存在且包含正确的变量
- 检查环境变量名称是否正确（注意大小写）
- 重启开发服务器以加载新的环境变量

### 2. Vercel 部署问题

- 在 Vercel 控制台检查环境变量配置
- 确保重新部署以应用新的环境变量
- 检查 Vercel 函数日志以获取详细错误信息

### 3. API 调用问题

- 确保请求头中包含正确的 `x-api-key`
- 检查 API 密钥是否与服务器配置匹配
- 使用浏览器开发者工具检查网络请求

## 示例代码

### JavaScript/TypeScript

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

### cURL

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

## 更新日志

- **2024-01-XX**: 初始实现 API 密钥验证
- 添加了对所有 TTS 相关端点的保护
- 更新了前端代码以包含 API 密钥头部
- 创建了环境变量配置示例