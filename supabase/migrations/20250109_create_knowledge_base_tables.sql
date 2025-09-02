-- 知识库功能数据库迁移文件
-- 创建知识库表和知识条目表，并更新ai_roles表

-- 创建知识库表
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建知识库表索引
CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX idx_knowledge_bases_created_at ON knowledge_bases(created_at DESC);

-- 设置知识库表权限
GRANT SELECT ON knowledge_bases TO anon;
GRANT ALL PRIVILEGES ON knowledge_bases TO authenticated;

-- 启用知识库表RLS
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

-- 创建知识库表RLS策略
CREATE POLICY "Users can view their own knowledge bases" ON knowledge_bases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge bases" ON knowledge_bases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge bases" ON knowledge_bases
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge bases" ON knowledge_bases
    FOR DELETE USING (auth.uid() = user_id);

-- 创建知识条目表
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    explanation TEXT NOT NULL,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建知识条目表索引
CREATE INDEX idx_knowledge_entries_knowledge_base_id ON knowledge_entries(knowledge_base_id);
CREATE INDEX idx_knowledge_entries_keywords ON knowledge_entries USING GIN(keywords);
CREATE INDEX idx_knowledge_entries_created_at ON knowledge_entries(created_at DESC);

-- 设置知识条目表权限
GRANT SELECT ON knowledge_entries TO anon;
GRANT ALL PRIVILEGES ON knowledge_entries TO authenticated;

-- 启用知识条目表RLS
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

-- 创建知识条目表RLS策略
CREATE POLICY "Users can view entries from their knowledge bases" ON knowledge_entries
    FOR SELECT USING (
        knowledge_base_id IN (
            SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert entries to their knowledge bases" ON knowledge_entries
    FOR INSERT WITH CHECK (
        knowledge_base_id IN (
            SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update entries in their knowledge bases" ON knowledge_entries
    FOR UPDATE USING (
        knowledge_base_id IN (
            SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete entries from their knowledge bases" ON knowledge_entries
    FOR DELETE USING (
        knowledge_base_id IN (
            SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
        )
    );

-- 为ai_roles表添加knowledge_base_id字段
ALTER TABLE ai_roles ADD COLUMN knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL;

-- 创建ai_roles表knowledge_base_id字段索引
CREATE INDEX idx_ai_roles_knowledge_base_id ON ai_roles(knowledge_base_id);

-- 插入示例知识库（仅在用户存在时）
DO $$
BEGIN
    -- 检查是否有用户存在，如果有则插入示例数据
    IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
        INSERT INTO knowledge_bases (name, description, user_id) 
        SELECT 
            '编程知识库', 
            '包含各种编程概念和技术的知识库', 
            (SELECT id FROM auth.users LIMIT 1)
        WHERE NOT EXISTS (SELECT 1 FROM knowledge_bases WHERE name = '编程知识库');
        
        INSERT INTO knowledge_bases (name, description, user_id) 
        SELECT 
            '产品设计知识库', 
            '产品设计相关的概念和方法论', 
            (SELECT id FROM auth.users LIMIT 1)
        WHERE NOT EXISTS (SELECT 1 FROM knowledge_bases WHERE name = '产品设计知识库');
        
        -- 插入示例知识条目
        INSERT INTO knowledge_entries (name, keywords, explanation, knowledge_base_id) 
        SELECT 
            'React Hooks', 
            '{"React", "Hooks", "useState", "useEffect"}', 
            'React Hooks是React 16.8引入的新特性，允许在函数组件中使用状态和其他React特性。', 
            (SELECT id FROM knowledge_bases WHERE name = '编程知识库' LIMIT 1)
        WHERE EXISTS (SELECT 1 FROM knowledge_bases WHERE name = '编程知识库')
        AND NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE name = 'React Hooks');
        
        INSERT INTO knowledge_entries (name, keywords, explanation, knowledge_base_id) 
        SELECT 
            '用户体验设计', 
            '{"UX", "用户体验", "设计", "可用性"}', 
            '用户体验设计是创造有意义且相关的产品使用体验的过程，涉及整个产品获取和集成过程。', 
            (SELECT id FROM knowledge_bases WHERE name = '产品设计知识库' LIMIT 1)
        WHERE EXISTS (SELECT 1 FROM knowledge_bases WHERE name = '产品设计知识库')
        AND NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE name = '用户体验设计');
    END IF;
END $$;