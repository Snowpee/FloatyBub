-- 创建 Snowflake ID 相关的数据库函数
-- 修复 dataIntegrityChecker.ts 中调用的缺失函数

-- 创建检查重复 Snowflake ID 的函数
CREATE OR REPLACE FUNCTION check_duplicate_snowflake_ids(user_id_param UUID)
RETURNS TABLE (
    snowflake_id BIGINT,
    duplicate_count INTEGER,
    message_ids TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 返回指定用户的重复 Snowflake ID 信息
    RETURN QUERY
    SELECT 
        m.snowflake_id,
        COUNT(*)::INTEGER as duplicate_count,
        ARRAY_AGG(m.id::TEXT) as message_ids
    FROM messages m
    INNER JOIN chat_sessions s ON m.session_id = s.id
    WHERE s.user_id = user_id_param
        AND m.snowflake_id IS NOT NULL
    GROUP BY m.snowflake_id
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC, m.snowflake_id;
END;
$$;

-- 为函数添加注释
COMMENT ON FUNCTION check_duplicate_snowflake_ids(UUID) IS 
'检查指定用户的重复 Snowflake ID，返回重复的 ID、重复次数和相关消息 ID 列表';

-- 创建获取用户消息统计的函数
CREATE OR REPLACE FUNCTION get_user_message_stats(user_id_param UUID)
RETURNS TABLE (
    total_messages INTEGER,
    messages_with_snowflake_id INTEGER,
    messages_without_snowflake_id INTEGER,
    duplicate_snowflake_ids INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_messages,
        COUNT(m.snowflake_id)::INTEGER as messages_with_snowflake_id,
        (COUNT(*) - COUNT(m.snowflake_id))::INTEGER as messages_without_snowflake_id,
        (
            SELECT COUNT(DISTINCT m2.snowflake_id)::INTEGER
            FROM messages m2
            INNER JOIN chat_sessions s2 ON m2.session_id = s2.id
            WHERE s2.user_id = user_id_param
                AND m2.snowflake_id IS NOT NULL
                AND m2.snowflake_id IN (
                    SELECT m3.snowflake_id
                    FROM messages m3
                    INNER JOIN chat_sessions s3 ON m3.session_id = s3.id
                    WHERE s3.user_id = user_id_param
                        AND m3.snowflake_id IS NOT NULL
                    GROUP BY m3.snowflake_id
                    HAVING COUNT(*) > 1
                )
        ) as duplicate_snowflake_ids
    FROM messages m
    INNER JOIN chat_sessions s ON m.session_id = s.id
    WHERE s.user_id = user_id_param;
END;
$$;

-- 为函数添加注释
COMMENT ON FUNCTION get_user_message_stats(UUID) IS 
'获取指定用户的消息统计信息，包括总消息数、有/无 Snowflake ID 的消息数、重复 Snowflake ID 数量';

-- 创建修复重复 Snowflake ID 的函数（仅用于紧急修复）
CREATE OR REPLACE FUNCTION fix_duplicate_snowflake_ids(user_id_param UUID, dry_run BOOLEAN DEFAULT TRUE)
RETURNS TABLE (
    action TEXT,
    message_id UUID,
    old_snowflake_id BIGINT,
    new_snowflake_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    new_id BIGINT;
BEGIN
    -- 警告：这是一个危险操作，默认为 dry_run 模式
    IF NOT dry_run THEN
        RAISE NOTICE '⚠️ 正在执行 Snowflake ID 修复操作（非 dry_run 模式）';
    ELSE
        RAISE NOTICE 'ℹ️ 运行在 dry_run 模式，不会实际修改数据';
    END IF;

    -- 查找重复的 Snowflake ID
    FOR rec IN (
        SELECT 
            m.id as message_id,
            m.snowflake_id,
            ROW_NUMBER() OVER (PARTITION BY m.snowflake_id ORDER BY m.created_at) as rn
        FROM messages m
        INNER JOIN chat_sessions s ON m.session_id = s.id
        WHERE s.user_id = user_id_param
            AND m.snowflake_id IS NOT NULL
            AND m.snowflake_id IN (
                SELECT m2.snowflake_id
                FROM messages m2
                INNER JOIN chat_sessions s2 ON m2.session_id = s2.id
                WHERE s2.user_id = user_id_param
                    AND m2.snowflake_id IS NOT NULL
                GROUP BY m2.snowflake_id
                HAVING COUNT(*) > 1
            )
        ORDER BY m.snowflake_id, m.created_at
    ) LOOP
        -- 保留第一个，修复其他重复的
        IF rec.rn > 1 THEN
            -- 生成新的 Snowflake ID（简化版本，实际应该调用专门的生成函数）
            new_id := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT << 22 | 
                     (RANDOM() * 1023)::BIGINT << 12 | 
                     (RANDOM() * 4095)::BIGINT;
            
            IF NOT dry_run THEN
                UPDATE messages 
                SET snowflake_id = new_id 
                WHERE id = rec.message_id;
            END IF;
            
            RETURN QUERY SELECT 
                'FIXED'::TEXT as action,
                rec.message_id,
                rec.snowflake_id as old_snowflake_id,
                new_id as new_snowflake_id;
        ELSE
            RETURN QUERY SELECT 
                'KEPT'::TEXT as action,
                rec.message_id,
                rec.snowflake_id as old_snowflake_id,
                rec.snowflake_id as new_snowflake_id;
        END IF;
    END LOOP;
END;
$$;

-- 为函数添加注释
COMMENT ON FUNCTION fix_duplicate_snowflake_ids(UUID, BOOLEAN) IS 
'修复重复的 Snowflake ID（危险操作，默认 dry_run 模式）';

-- 授予必要的权限
GRANT EXECUTE ON FUNCTION check_duplicate_snowflake_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_message_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_duplicate_snowflake_ids(UUID, BOOLEAN) TO authenticated;

-- 验证函数创建
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_name = 'check_duplicate_snowflake_ids'
        AND routine_type = 'FUNCTION'
    ) THEN
        RAISE NOTICE '✅ check_duplicate_snowflake_ids 函数创建成功';
    ELSE
        RAISE NOTICE '❌ check_duplicate_snowflake_ids 函数创建失败';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_name = 'get_user_message_stats'
        AND routine_type = 'FUNCTION'
    ) THEN
        RAISE NOTICE '✅ get_user_message_stats 函数创建成功';
    ELSE
        RAISE NOTICE '❌ get_user_message_stats 函数创建失败';
    END IF;
END $$;