-- 阶段一：核心字段更新
-- 为messages表和chat_sessions表添加遗漏的字段

-- ============================================
-- 1. ChatMessage 表更新 (messages)
-- ============================================

-- 添加消息版本管理字段
ALTER TABLE messages ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '[]';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS current_version_index INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_streaming BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_reasoning_complete BOOLEAN DEFAULT true;

-- 添加字段注释
COMMENT ON COLUMN messages.versions IS '消息的多个版本内容数组';
COMMENT ON COLUMN messages.current_version_index IS '当前显示的版本索引';
COMMENT ON COLUMN messages.is_streaming IS '消息是否正在流式传输';
COMMENT ON COLUMN messages.is_reasoning_complete IS '思考过程是否完成';

-- ============================================
-- 2. ChatSession 表更新 (chat_sessions)
-- ============================================

-- 添加会话状态管理字段
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 添加字段注释
COMMENT ON COLUMN chat_sessions.is_hidden IS '是否从侧边栏隐藏';
COMMENT ON COLUMN chat_sessions.is_pinned IS '是否置顶显示';

-- ============================================
-- 3. 创建索引优化查询性能
-- ============================================

-- 为chat_sessions表添加索引
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned ON chat_sessions(is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_hidden ON chat_sessions(is_hidden, updated_at DESC);

-- 为messages表的新字段添加索引（如果需要）
CREATE INDEX IF NOT EXISTS idx_messages_streaming ON messages(is_streaming) WHERE is_streaming = true;
CREATE INDEX IF NOT EXISTS idx_messages_reasoning ON messages(is_reasoning_complete) WHERE is_reasoning_complete = false;

-- ============================================
-- 4. 数据完整性验证
-- ============================================

-- 验证新字段是否正确添加
DO $$
BEGIN
    -- 检查messages表的新字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'versions'
    ) THEN
        RAISE EXCEPTION 'messages.versions字段添加失败';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'current_version_index'
    ) THEN
        RAISE EXCEPTION 'messages.current_version_index字段添加失败';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'is_streaming'
    ) THEN
        RAISE EXCEPTION 'messages.is_streaming字段添加失败';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'is_reasoning_complete'
    ) THEN
        RAISE EXCEPTION 'messages.is_reasoning_complete字段添加失败';
    END IF;
    
    -- 检查chat_sessions表的新字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'is_hidden'
    ) THEN
        RAISE EXCEPTION 'chat_sessions.is_hidden字段添加失败';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'is_pinned'
    ) THEN
        RAISE EXCEPTION 'chat_sessions.is_pinned字段添加失败';
    END IF;
    
    RAISE NOTICE '阶段一数据库更新完成：所有字段已成功添加';
END $$;

-- ============================================
-- 5. 更新现有数据的默认值（如果需要）
-- ============================================

-- 确保现有消息的版本数组包含当前内容
UPDATE messages 
SET versions = jsonb_build_array(content)
WHERE versions = '[]' AND content IS NOT NULL;

-- 统计更新结果
DO $$
DECLARE
    message_count INTEGER;
    session_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO message_count FROM messages;
    SELECT COUNT(*) INTO session_count FROM chat_sessions;
    
    RAISE NOTICE '数据库更新统计：';
    RAISE NOTICE '- 消息总数: %', message_count;
    RAISE NOTICE '- 会话总数: %', session_count;
    RAISE NOTICE '- 新增字段: messages表4个，chat_sessions表2个';
    RAISE NOTICE '- 新增索引: 4个';
END $$;