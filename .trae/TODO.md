# TODO:

- [x] 1: 创建数据库迁移脚本，添加 message_timestamp 字段和索引 (priority: High)
- [x] 2: 执行数据迁移，将现有 metadata.timestamp 迁移到 message_timestamp (priority: High)
- [x] 3: 更新 Supabase TypeScript 类型定义，添加 message_timestamp 字段 (priority: High)
- [x] 4: 修改消息同步逻辑，移除对 created_at 的手动设置 (priority: High)
- [x] 5: 更新消息查询逻辑，使用 message_timestamp 进行排序 (priority: High)
- [x] 6: 测试新的消息创建和同步流程 (priority: Medium)
- [x] 7: 验证消息排序的正确性和数据完整性 (priority: Medium)
