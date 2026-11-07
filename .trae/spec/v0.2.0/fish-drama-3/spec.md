# Fish Audio Drama 3 支持

- 来源：https://docs.fish.audio/features/text-to-speech/drama-3
- 语音设置与调试页模型列表增加 drama-3、s2.1-pro、s2.1-pro-free，旧版本选项继续保留。
- 新配置和缺失模型版本时默认 drama-3；明确保存的旧模型版本不强制升级。
- 更新本地代理与 Vercel TTS 白名单及默认值，普通 POST 和流式 GET 都通过上游 `model` 请求头选择模型。
- 缓存键包含有效模型版本，不复用旧模型音频作为 Drama 3 结果。
- 设置页补充方括号表演指令与成对语气标签提示，不修改用户原文。
- 部署时需要一起更新代理服务；仅更新前端无法使旧代理支持新模型。

验证：类型检查与生产构建通过；`node tests/voice/check-tts-models.cjs` 离线验证模型列表、默认值、GET/POST 模型请求头、旧版本兼容和 Drama 3 指令原样转发。未调用付费 Fish Audio 接口试听。
