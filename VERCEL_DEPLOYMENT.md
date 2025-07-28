# Vercel 部署指南

本项目已配置为支持 Vercel Serverless Functions，可以将前端和后端一起部署到 Vercel 平台。

## 🚀 部署步骤

### 1. 准备代码

确保你的代码已经推送到 GitHub 仓库：

```bash
git add .
git commit -m "配置 Vercel Serverless Functions"
git push origin main
```

### 2. 连接 Vercel

1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录
3. 点击 "New Project"
4. 导入你的 GitHub 仓库
5. 选择项目并点击 "Import"

### 3. 配置环境变量

在 Vercel 项目设置中添加环境变量：

1. 进入项目 Dashboard
2. 点击 "Settings" 标签
3. 选择 "Environment Variables"
4. 添加以下变量：

```
FISH_AUDIO_API_KEY = your_fish_audio_api_key_here
```

**重要**: 将 `your_fish_audio_api_key_here` 替换为你的实际 Fish Audio API 密钥。

### 4. 部署

1. 点击 "Deploy" 按钮
2. 等待部署完成（通常需要 1-3 分钟）
3. 部署成功后，你会获得一个 `.vercel.app` 域名

## 📁 项目结构

部署后的项目结构：

```
.
├── api/                    # Serverless Functions
│   ├── tts.js              # TTS API 端点
│   ├── health.js           # 健康检查端点
│   ├── models.js           # 模型列表端点
│   └── package.json        # API 依赖
├── src/                    # 前端源码
├── vercel.json             # Vercel 配置
└── ...
```

## 🔧 API 端点

部署后可用的 API 端点：

- `GET /api/health` - 健康检查
- `POST /api/tts` - 文本转语音
- `GET /api/models` - 获取可用模型列表

## 🌐 访问应用

部署完成后：

1. 访问你的 Vercel 域名（如：`https://your-project.vercel.app`）
2. 直接访问语音测试页面：`https://your-project.vercel.app/voice-test`
3. 应用会自动检测环境并使用正确的 API 地址

## 🔍 故障排除

### 部署失败

1. **检查构建日志**：在 Vercel Dashboard 中查看详细的构建日志
2. **检查依赖**：确保 `api/package.json` 中的依赖正确
3. **检查语法**：确保所有 JavaScript 文件语法正确

### API 调用失败

1. **检查环境变量**：确保 `FISH_AUDIO_API_KEY` 已正确设置
2. **检查 API 密钥**：确保 Fish Audio API 密钥有效且有足够配额
3. **查看函数日志**：在 Vercel Dashboard 的 "Functions" 标签中查看日志

### 前端错误

1. **清除缓存**：强制刷新浏览器（Ctrl+F5 或 Cmd+Shift+R）
2. **检查控制台**：打开浏览器开发者工具查看错误信息
3. **检查网络**：确保网络连接正常

## ⚡ 性能优化

### Serverless Functions 限制

- **执行时间**：最大 30 秒（TTS 函数）
- **内存**：默认 1024MB
- **冷启动**：首次调用可能有 1-2 秒延迟

### 优化建议

1. **文本长度**：建议单次转换文本不超过 500 字符
2. **并发请求**：避免同时发起多个 TTS 请求
3. **缓存策略**：考虑在前端缓存生成的音频

## 🔒 安全注意事项

1. **API 密钥保护**：API 密钥只在服务器端使用，不会暴露给前端
2. **CORS 配置**：已配置适当的 CORS 头部
3. **请求验证**：所有 API 端点都有基本的请求验证

## 📊 监控和分析

在 Vercel Dashboard 中可以查看：

- **函数调用次数**：监控 API 使用情况
- **响应时间**：优化性能
- **错误率**：及时发现问题
- **带宽使用**：控制成本

## 💰 成本估算

Vercel 免费计划包括：

- **函数调用**：每月 100GB-小时
- **带宽**：每月 100GB
- **构建时间**：每月 6000 分钟

对于中等使用量的 TTS 应用，免费计划通常足够使用。

## 🆘 获取帮助

如果遇到问题：

1. 查看 [Vercel 官方文档](https://vercel.com/docs)
2. 检查 [Fish Audio API 文档](https://docs.fish.audio/)
3. 查看项目的 GitHub Issues
4. 联系技术支持

---

🎉 现在你的 Fish Audio TTS 应用已经成功部署到 Vercel！