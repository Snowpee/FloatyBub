# Fish Audio 语音功能设置指南

本项目已集成 Fish Audio 文本转语音功能，包含自建后端代理服务和前端测试页面。

## 🎯 功能特性

- 🔐 安全的后端代理服务，保护 API 密钥
- 🎵 支持多种音频格式（MP3、WAV）
- 🎤 支持语音克隆（上传参考音频）
- 📱 响应式前端测试界面
- 🌐 跨域支持，便于开发和部署

## 🚀 快速开始

### 1. 获取 Fish Audio API 密钥

1. 访问 [Fish Audio 官网](https://fish.audio/)
2. 注册账号并获取 API 密钥
3. 保存你的 API 密钥，稍后需要配置

### 2. 配置后端服务

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

### 3. 启动服务

#### 方法一：使用启动脚本（推荐）

```bash
# 在项目根目录下运行
./start-tts-server.sh
```

#### 方法二：手动启动

```bash
# 启动后端服务
cd tts-server
npm run dev

# 在另一个终端启动前端服务
cd ..
npm run dev
```

### 4. 访问测试页面

1. 确保前端服务运行在 `http://localhost:5173`
2. 确保后端服务运行在 `http://localhost:3001`
3. 在浏览器中访问前端应用
4. 点击侧边栏的「语音测试」按钮
5. 或直接访问 `http://localhost:5173/voice-test`

## 📖 使用说明

### 基础文本转语音

1. 在文本框中输入要转换的内容
2. 选择音频格式（MP3/WAV）
3. 调整比特率、延迟模式等参数
4. 点击「生成语音」按钮
5. 等待生成完成后播放或下载音频

### 语音克隆功能

1. 点击「添加音频」按钮上传参考音频文件
2. 为每个参考音频输入对应的文本内容
3. 输入要转换的目标文本
4. 生成语音时会基于参考音频的声音特征

### 配置选项说明

- **音频格式**: MP3 或 WAV
- **MP3 比特率**: 64/128/192/320 kbps
- **延迟模式**: 普通/平衡（影响生成速度和质量）
- **文本块长度**: 单次处理的文本长度（50-500）
- **预设语音 ID**: 使用预设的语音模型
- **标准化音频**: 是否对输出音频进行标准化处理

## 🔧 故障排除

### 后端服务无法启动

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

### API 调用失败

1. **检查 API 密钥是否有效**:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" https://api.fish.audio/v1/models
   ```

2. **检查网络连接**:
   ```bash
   ping api.fish.audio
   ```

3. **查看后端日志**:
   后端服务会输出详细的错误信息，检查控制台日志

### 前端页面错误

1. **检查服务器状态**: 页面顶部会显示后端服务器的连接状态
2. **清除浏览器缓存**: 强制刷新页面（Ctrl+F5 或 Cmd+Shift+R）
3. **检查控制台错误**: 打开浏览器开发者工具查看错误信息

### 音频生成缓慢

1. **调整文本块长度**: 减小 `chunk_length` 参数
2. **选择平衡延迟模式**: 在配置中选择「平衡」模式
3. **检查网络状况**: 确保网络连接稳定

## 📁 项目结构

```
.
├── tts-server/                 # 后端代理服务
│   ├── server.js               # 主服务器文件
│   ├── package.json            # 后端依赖配置
│   ├── .env.example            # 环境变量模板
│   └── README.md               # 后端服务说明
├── src/
│   ├── pages/VoiceTest.tsx     # 语音测试页面
│   └── router/index.tsx        # 路由配置
├── start-tts-server.sh         # 服务启动脚本
└── VOICE_SETUP.md              # 本说明文档
```

## 🔒 安全注意事项

1. **API 密钥保护**: 永远不要在前端代码中暴露 Fish Audio API 密钥
2. **环境变量**: 确保 `.env` 文件不被提交到版本控制系统
3. **CORS 配置**: 生产环境中应限制 CORS 来源域名
4. **请求限制**: 考虑添加请求频率限制和用户认证

## 📚 相关文档

- [Fish Audio 官方文档](https://docs.fish.audio/)
- [Fish Audio Python SDK](https://github.com/fishaudio/fish-speech)
- [项目后端服务文档](./tts-server/README.md)

## 🆘 获取帮助

如果遇到问题，请检查：

1. 后端服务日志输出
2. 浏览器开发者工具控制台
3. Fish Audio API 状态和配额
4. 网络连接和防火墙设置

---

🎉 现在你可以开始使用 Fish