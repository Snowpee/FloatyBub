# Fish Audio TTS 代理服务

这是一个基于 Node.js Express 的代理服务，用于安全地调用 Fish Audio 的文本转语音 API。

## 功能特性

- 🔐 安全的 API 密钥管理
- 🎵 支持多种音频格式（MP3、WAV 等）
- 🎤 支持语音克隆（参考音频上传）
- 📦 自动处理 msgpack 编码/解码
- 🌐 CORS 支持，便于前端调用
- 📊 健康检查和状态监控

## 快速开始

### 1. 安装依赖

```bash
cd tts-server
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，添加你的 Fish Audio API 密钥
# FISH_AUDIO_API_KEY=your_actual_api_key_here
```

### 3. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3001` 启动。

## API 端点

### POST /api/tts

生成语音文件。

**请求参数：**

- `text` (必需): 要转换的文本
- `format` (可选): 音频格式，默认 'mp3'
- `mp3_bitrate` (可选): MP3 比特率，默认 128
- `reference_id` (可选): 预设语音 ID
- `normalize` (可选): 是否标准化音频，默认 true
- `latency` (可选): 延迟模式，默认 'normal'
- `chunk_length` (可选): 文本块长度，默认 200
- `references` (可选): 参考音频文件（用于语音克隆）

**示例请求：**

```javascript
const formData = new FormData();
formData.append('text', '你好，这是一个测试。');
formData.append('format', 'mp3');

fetch('http://localhost:3001/api/tts', {
  method: 'POST',
  body: formData
})
.then(response => response.blob())
.then(blob => {
  const audio = new Audio(URL.createObjectURL(blob));
  audio.play();
});
```

### GET /api/health

健康检查端点。

**响应示例：**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "api_key_configured": true
}
```

### GET /api/models

获取可用的语音模型列表。

## 错误处理

服务包含完整的错误处理机制：

- 400: 请求参数错误
- 401: API 密钥未配置或无效
- 500: 服务器内部错误
- Fish Audio API 错误会被转发并包含详细信息

## 安全注意事项

1. **API 密钥安全**: 永远不要在前端代码中暴露 Fish Audio API 密钥
2. **CORS 配置**: 生产环境中应限制 CORS 来源
3. **请求限制**: 考虑添加请求频率限制
4. **文件大小**: 当前限制上传文件大小为 50MB

## 开发说明

- 使用 `nodemon` 进行开发时的自动重启
- 支持环境变量配置
- 包含详细的控制台日志
- 支持优雅关闭

## 故障排除

1. **API 密钥错误**: 检查 `.env` 文件中的 `FISH_AUDIO_API_KEY` 是否正确
2. **网络错误**: 确保服务器可以访问 `api.fish.audio`
3. **端口冲突**: 修改 `.env` 中的 `PORT` 值
4. **依赖问题**: 删除 `node_modules` 并重新 `npm install`

## 许可证

MIT License