-- 添加 snowflake_id 字段到 messages 表
-- 用于分布式环境下的唯一标识和消息排序

ALTER TABLE messages ADD COLUMN snowflake_id BIGINT;

-- 创建索引以优化排序性能
CREATE INDEX idx_messages_snowflake_id ON messages(snowflake_id);

-- 添加字段注释
COMMENT ON COLUMN messages.snowflake_id IS 'Snowflake ID for distributed unique identification and ordering';