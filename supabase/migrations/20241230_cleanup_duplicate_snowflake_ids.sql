-- 清理重复的 Snowflake ID，为添加唯一约束做准备
-- 这个脚本会保留最早创建的记录，删除重复的记录

-- 首先显示重复的 snowflake_id 情况
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- 统计重复的 snowflake_id 数量
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT snowflake_id 
        FROM messages 
        WHERE snowflake_id IS NOT NULL 
        GROUP BY snowflake_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE '发现 % 个重复的 snowflake_id', duplicate_count;
END $$;

-- 直接清理重复的 snowflake_id，保留最早创建的记录
WITH duplicate_snowflake_ids AS (
    SELECT snowflake_id
    FROM messages 
    WHERE snowflake_id IS NOT NULL 
    GROUP BY snowflake_id 
    HAVING COUNT(*) > 1
),
to_delete AS (
    SELECT m.id
    FROM messages m
    INNER JOIN duplicate_snowflake_ids d ON m.snowflake_id = d.snowflake_id
    WHERE m.id != (
        SELECT m2.id 
        FROM messages m2 
        WHERE m2.snowflake_id = m.snowflake_id 
        ORDER BY m2.created_at ASC 
        LIMIT 1
    )
)
DELETE FROM messages 
WHERE id IN (SELECT id FROM to_delete);

-- 验证清理结果
DO $$
DECLARE
    remaining_duplicates INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_duplicates
    FROM (
        SELECT snowflake_id 
        FROM messages 
        WHERE snowflake_id IS NOT NULL 
        GROUP BY snowflake_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF remaining_duplicates = 0 THEN
        RAISE NOTICE '重复的 snowflake_id 清理完成';
    ELSE
        RAISE NOTICE '仍有 % 个重复的 snowflake_id', remaining_duplicates;
    END IF;
END $$;

-- 现在添加唯一约束
ALTER TABLE messages 
ADD CONSTRAINT messages_snowflake_id_unique 
UNIQUE (snowflake_id);

-- 创建部分索引，只对非空的 snowflake_id 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_snowflake_id_unique 
ON messages (snowflake_id) 
WHERE snowflake_id IS NOT NULL;

-- 添加注释说明约束的用途
COMMENT ON CONSTRAINT messages_snowflake_id_unique ON messages IS 
'确保 Snowflake ID 的唯一性，防止重复的 Snowflake ID 被插入数据库';

COMMENT ON INDEX idx_messages_snowflake_id_unique IS 
'Snowflake ID 唯一索引，提高基于 snowflake_id 的查询性能';

-- 最终验证
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
    
    -- 统计最终的 snowflake_id 情况
    RAISE NOTICE '📊 最终统计:';
    RAISE NOTICE '  - 总消息数: %', (SELECT COUNT(*) FROM messages);
    RAISE NOTICE '  - 有 snowflake_id 的消息数: %', (SELECT COUNT(*) FROM messages WHERE snowflake_id IS NOT NULL);
    RAISE NOTICE '  - 无 snowflake_id 的消息数: %', (SELECT COUNT(*) FROM messages WHERE snowflake_id IS NULL);
END $$;