-- 为 snowflake_id 添加唯一约束，防止重复的 Snowflake ID
-- 这是 Snowflake ID 保护机制的数据库层面保护

-- 首先检查是否存在重复的 snowflake_id
DO $$
BEGIN
    -- 检查重复的 snowflake_id
    IF EXISTS (
        SELECT snowflake_id 
        FROM messages 
        WHERE snowflake_id IS NOT NULL 
        GROUP BY snowflake_id 
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE '⚠️ 发现重复的 snowflake_id，请先清理重复数据';
        -- 显示重复的 snowflake_id
        RAISE NOTICE '重复的 snowflake_id: %', (
            SELECT string_agg(snowflake_id::text, ', ') 
            FROM (
                SELECT snowflake_id 
                FROM messages 
                WHERE snowflake_id IS NOT NULL 
                GROUP BY snowflake_id 
                HAVING COUNT(*) > 1
            ) duplicates
        );
    ELSE
        RAISE NOTICE '✅ 没有发现重复的 snowflake_id，可以安全添加唯一约束';
    END IF;
END $$;

-- 为 snowflake_id 添加唯一约束
-- 注意：只有在没有重复数据的情况下才能成功添加约束
ALTER TABLE messages 
ADD CONSTRAINT messages_snowflake_id_unique 
UNIQUE (snowflake_id);

-- 创建部分索引，只对非空的 snowflake_id 创建索引
-- 这样可以提高查询性能，同时允许多个 NULL 值
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_snowflake_id_unique 
ON messages (snowflake_id) 
WHERE snowflake_id IS NOT NULL;

-- 添加注释说明约束的用途
COMMENT ON CONSTRAINT messages_snowflake_id_unique ON messages IS 
'确保 Snowflake ID 的唯一性，防止重复的 Snowflake ID 被插入数据库';

COMMENT ON INDEX idx_messages_snowflake_id_unique IS 
'Snowflake ID 唯一索引，提高基于 snowflake_id 的查询性能';

-- 验证约束是否成功添加
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_snowflake_id_unique' 
        AND table_name = 'messages'
    ) THEN
        RAISE NOTICE '✅ Snowflake ID 唯一约束添加成功';
    ELSE
        RAISE NOTICE '❌ Snowflake ID 唯一约束添加失败';
    END IF;
END $$;