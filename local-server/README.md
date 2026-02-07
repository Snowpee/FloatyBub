# 本地代理服务 (Local Proxy Server)

这是一个基于 Node.js Express 的代理服务，用于在本地安全地提供 TTS、联网搜索等接口能力。

## 功能特性

- 🔐 安全的 API 密钥管理和验证
- 🎵 支持多种音频格式（MP3、WAV 等）
- 📦 自动处理 msgpack 编码/解码
- 🌐 CORS 支持，便于前端调用
- 📊 健康检查和状态监控
- 🔍 Fish Audio API 密钥验证
- 📋 模型信息查询功能

## 快速开始

### 1. 安装依赖

```bash
cd local-server
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置以下参数：
# FISH_AUDIO_API_KEY=your_fish_audio_api_key_here  # Fish Audio API 密钥（可选，由前端提供）
# API_SECRET=your_secret_api_key_here              # 服务器访问密钥（必需）
# PORT=3001                                        # 服务器端口（可选）
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
- `fish_audio_key` (必需): Fish Audio API 密钥
- `format` (可选): 音频格式，默认 'mp3'
- `mp3_bitrate` (可选): MP3 比特率，默认 128
- `reference_id` (可选): 预设语音 ID
- `normalize` (可选): 是否标准化音频，默认 true
- `latency` (可选): 延迟模式，默认 'normal'
- `chunk_length` (可选): 文本块长度，默认 200
- `model` (可选): 语音模型，默认 'speech-1.6'

**示例请求：**

```javascript
const requestData = {
  text: '你好，这是一个测试。',
  fish_audio_key: 'your_fish_audio_api_key',
  format: 'mp3',
  model: 'speech-1.6'
};

fetch('http://localhost:3001/api/tts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your_server_api_secret'
  },
  body: JSON.stringify(requestData)
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
  "note": "Fish Audio API Key 由前端提供",
  "server_info": {
    "node_version": "v18.20.5",
    "platform": "darwin",
    "uptime": 3600
  }
}
```

### GET /api/tts

获取支持的语音模型列表。

**请求头：**
- `x-api-key`: 服务器访问密钥

**响应示例：**

```json
{
  "success": true,
  "models": ["speech-1.5", "speech-1.6", "s1"],
  "default": "speech-1.6"
}
```

### POST /api/validate-key

验证 Fish Audio API 密钥有效性。

**请求头：**
- `x-api-key`: 服务器访问密钥

**请求参数：**
- `apiKey` (必需): Fish Audio API 密钥
- `apiUrl` (可选): Fish Audio API 地址

**响应示例：**

```json
{
  "valid": true
}
```

### POST /api/fish-model

获取 Fish Audio 模型详细信息。

**请求头：**
- `x-api-key`: 服务器访问密钥

**请求参数：**
- `model_id` (必需): 模型 ID
- `fish_audio_key` (必需): Fish Audio API 密钥

**响应示例：**

```json
{
  "title": "模型名称",
  "type": "模型类型",
  "description": "模型描述"
}
```

## 错误处理

服务包含完整的错误处理机制：

- 400: 请求参数错误
- 401: API 密钥未配置或无效
- 500: 服务器内部错误
- Fish Audio API 错误会被转发并包含详细信息

## 安全注意事项

1. **API 密钥安全**: 
   - Fish Audio API 密钥由前端提供，不在服务器端存储
   - 服务器访问密钥 (API_SECRET) 必须妥善保管
   - 永远不要在前端代码中暴露服务器访问密钥
2. **CORS 配置**: 生产环境中应限制 CORS 来源
3. **请求限制**: 考虑添加请求频率限制
4. **访问控制**: 所有 API 端点都需要有效的服务器访问密钥

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
