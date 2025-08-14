-- 添加 message_timestamp 字段到 messages 表
-- 这个字段将用于存储消息的业务时间戳，用于排序和显示
-- created_at 字段将保持为数据库记录的真实创建时间

-- 第一步：添加 message_timestamp 字段
ALTER TABLE messages 
ADD COLUMN message_timestamp TIMESTAMPTZ;

-- 第二步：从现有数据迁移时间戳
-- 优先使用 metadata.timestamp，如果不存在则使用 created_at
UPDATE messages 
SET message_timestamp = CASE 
    WHEN metadata->>'timestamp' IS NOT NULL 
    THEN (metadata->>'timestamp')::TIMESTAMPTZ
    ELSE created_at
END
WHERE message_timestamp IS NULL;

-- 第三步：设置 message_timestamp 为 NOT NULL
ALTER TABLE messages 
ALTER COLUMN message_timestamp SET NOT NULL;

-- 第四步：创建索引以优化查询性能
-- 为 message_timestamp 创建索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
ON messages (message_timestamp DESC);

-- 为 session_id + message_timestamp 创建复合索引（用于会话内消息排序）
CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp 
ON messages (session_id, message_timestamp DESC);

-- 第五步：添加注释说明字段用途
COMMENT ON COLUMN messages.message_timestamp IS '消息的业务时间戳，用于排序和显示，通常来自客户端的 timestamp 字段';
COMMENT ON COLUMN messages.created_at IS '数据库记录的真实创建时间，由数据库自动管理，不应手动修改';

-- 验证数据迁移结果
DO $$
BEGIN
    -- 检查是否所有消息都有 message_timestamp
    IF EXISTS (SELECT 1 FROM messages WHERE message_timestamp IS NULL) THEN
        RAISE EXCEPTION '数据迁移失败：仍有消息缺少 message_timestamp';
    END IF;
    
    -- 输出迁移统计信息
    RAISE NOTICE '数据迁移完成。总消息数: %', (SELECT COUNT(*) FROM messages);
    RAISE NOTICE '使用 metadata.timestamp 的消息数: %', 
        (SELECT COUNT(*) FROM messages WHERE metadata->>'timestamp' IS NOT NULL);
    RAISE NOTICE '使用 created_at 作为 message_timestamp 的消息数: %', 
        (SELECT COUNT(*) FROM messages WHERE metadata->>'timestamp' IS NULL);
END $$;