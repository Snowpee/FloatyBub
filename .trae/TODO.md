# TODO:

- [x] todo-1: 在store中添加needsTitle标记，用于跟踪哪些会话需要生成标题 (priority: High)
- [x] todo-2: 修改ChatPage中addMessage的回调，设置needsTitle标记而不是直接调用generateSessionTitle (priority: High)
- [x] todo-3: 在callAIAPI函数的AI回复完成处添加标题生成逻辑 (priority: High)
- [x] todo-4: 确保标题生成后清除needsTitle标记，避免重复生成 (priority: Medium)
