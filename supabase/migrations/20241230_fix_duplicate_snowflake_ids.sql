-- 修复当前数据库中的重复 Snowflake ID 问题
-- 这个脚本专门处理已经存在唯一约束后的重复数据清理

-- 首先检查当前重复情况
DO $$
DECLARE
    duplicate_count INTEGER;
    total_messages INTEGER;
BEGIN
    -- 统计总消息数
    SELECT COUNT(*) INTO total_messages FROM messages;
    
    -- 统计重复的 snowflake_id 数量
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT snowflake_id 
        FROM messages 
        WHERE snowflake_id IS NOT NULL 
        GROUP BY snowflake_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE '📊 当前数据库状态:';
    RAISE NOTICE '  - 总消息数: %', total_messages;
    RAISE NOTICE '  - 重复的 snowflake_id 数量: %', duplicate_count;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE '⚠️ 发现重复的 Snowflake ID，需要清理';
    ELSE
        RAISE NOTICE '✅ 没有发现重复的 Snowflake ID';
    END IF;
END $$;

-- 显示具体的重复记录
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT snowflake_id, COUNT(*) as count, 
               array_agg(id ORDER BY created_at ASC) as message_ids,
               array_agg(created_at ORDER BY created_at ASC) as created_times
        FROM messages 
        WHERE snowflake_id IS NOT NULL 
        GROUP BY snowflake_id 
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 10
    LOOP
        RAISE NOTICE '🔍 重复的 snowflake_id: % (出现 % 次)', rec.snowflake_id, rec.count;
        RAISE NOTICE '    消息IDs: %', rec.message_ids;
        RAISE NOTICE '    创建时间: %', rec.created_times;
    END LOOP;
END $$;

-- 安全地清理重复的 snowflake_id
-- 策略：保留最早创建的记录，将其他记录的 snowflake_id 设为 NULL
WITH duplicate_snowflake_ids AS (
    SELECT snowflake_id
    FROM messages 
    WHERE snowflake_id IS NOT NULL 
    GROUP BY snowflake_id 
    HAVING COUNT(*) > 1
),
to_nullify AS (
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
UPDATE messages 
SET snowflake_id = NULL
WHERE id IN (SELECT id FROM to_nullify);

-- 验证清理结果
DO $$
DECLARE
    remaining_duplicates INTEGER;
    updated_count INTEGER;
BEGIN
    -- 检查剩余重复数量
    SELECT COUNT(*) INTO remaining_duplicates
    FROM (
        SELECT snowflake_id 
        FROM messages 
        WHERE snowflake_id IS NOT NULL 
        GROUP BY snowflake_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE '🔧 清理操作完成:';
    
    IF remaining_duplicates = 0 THEN
        RAISE NOTICE '✅ 重复的 snowflake_id 清理成功';
        RAISE NOTICE '📊 最终统计:';
        RAISE NOTICE '  - 总消息数: %', (SELECT COUNT(*) FROM messages);
        RAISE NOTICE '  - 有 snowflake_id 的消息数: %', (SELECT COUNT(*) FROM messages WHERE snowflake_id IS NOT NULL);
        RAISE NOTICE '  - 无 snowflake_id 的消息数: %', (SELECT COUNT(*) FROM messages WHERE snowflake_id IS NULL);
    ELSE
        RAISE NOTICE '❌ 仍有 % 个重复的 snowflake_id 需要手动处理', remaining_duplicates;
    END IF;
END $$;

-- 验证唯一约束是否正常工作
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_snowflake_id_unique' 
        AND table_name = 'messages'
        AND constraint_type = 'UNIQUE'
    ) THEN
        RAISE NOTICE '✅ Snowflake ID 唯一约束正常工作';
    ELSE
        RAISE NOTICE '❌ Snowflake ID 唯一约束不存在或异常';
    END IF;
END $$;