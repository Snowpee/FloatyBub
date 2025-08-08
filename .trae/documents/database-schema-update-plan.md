# 数据库表结构更新计划

## 概述

基于本地数据结构与Supabase数据库表结构的对比分析，发现多个字段未同步到数据库。本文档提供完整的数据库表结构更新计划，确保云端数据同步功能的完整性。

## 🔍 遗漏字段分析

### 高优先级遗漏
- **消息版本管理**: ChatMessage表缺少版本控制字段
- **会话状态管理**: ChatSession表缺少置顶和隐藏状态
- **语音功能**: 完全缺失语音相关表结构

### 中等优先级遗漏
- **AI角色扩展**: 缺少开场白和语音设置
- **LLM配置扩展**: 缺少代理和启用状态

## 📋 表结构更新计划

### 1. ChatMessage 表更新

**新增字段**：
```sql
-- 添加消息版本管理字段
ALTER TABLE messages ADD COLUMN versions JSONB DEFAULT '[]';
ALTER TABLE messages ADD COLUMN current_version_index INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN is_streaming BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN is_reasoning_complete BOOLEAN DEFAULT true;

-- 添加字段注释
COMMENT ON COLUMN messages.versions IS '消息的多个版本内容数组';
COMMENT ON COLUMN messages.current_version_index IS '当前显示的版本索引';
COMMENT ON COLUMN messages.is_streaming IS '消息是否正在流式传输';
COMMENT ON COLUMN messages.is_reasoning_complete IS '思考过程是否完成';
```

### 2. ChatSession 表更新

**新增字段**：
```sql
-- 添加会话状态管理字段
ALTER TABLE chat_sessions ADD COLUMN is_hidden BOOLEAN DEFAULT false;
ALTER TABLE chat_sessions ADD COLUMN is_pinned BOOLEAN DEFAULT false;

-- 添加字段注释
COMMENT ON COLUMN chat_sessions.is_hidden IS '是否从侧边栏隐藏';
COMMENT ON COLUMN chat_sessions.is_pinned IS '是否置顶显示';

-- 添加索引优化查询
CREATE INDEX idx_chat_sessions_pinned ON chat_sessions(is_pinned DESC, updated_at DESC);
CREATE INDEX idx_chat_sessions_hidden ON chat_sessions(is_hidden, updated_at DESC);
```

### 3. AIRole 表更新

**新增字段**：
```sql
-- 添加AI角色扩展字段
ALTER TABLE ai_roles ADD COLUMN opening_messages JSONB DEFAULT '[]';
ALTER TABLE ai_roles ADD COLUMN current_opening_index INTEGER DEFAULT 0;
ALTER TABLE ai_roles ADD COLUMN global_prompt_id UUID REFERENCES global_prompts(id);
ALTER TABLE ai_roles ADD COLUMN voice_model_id UUID;

-- 添加字段注释
COMMENT ON COLUMN ai_roles.opening_messages IS '开场白消息数组';
COMMENT ON COLUMN ai_roles.current_opening_index IS '当前显示的开场白索引';
COMMENT ON COLUMN ai_roles.global_prompt_id IS '关联的全局提示词ID';
COMMENT ON COLUMN ai_roles.voice_model_id IS '角色专属语音模型ID';

-- 添加索引
CREATE INDEX idx_ai_roles_global_prompt ON ai_roles(global_prompt_id);
CREATE INDEX idx_ai_roles_voice_model ON ai_roles(voice_model_id);
```

### 4. LLMConfig 表更新

**新增字段**：
```sql
-- 添加LLM配置扩展字段
ALTER TABLE llm_configs ADD COLUMN proxy_url TEXT;
ALTER TABLE llm_configs ADD COLUMN enabled BOOLEAN DEFAULT true;

-- 添加字段注释
COMMENT ON COLUMN llm_configs.proxy_url IS '代理服务器地址';
COMMENT ON COLUMN llm_configs.enabled IS '配置是否启用';

-- 添加索引
CREATE INDEX idx_llm_configs_enabled ON llm_configs(enabled, user_id);
```

### 5. 新增 VoiceSettings 表

**创建表结构**：
```sql
-- 创建语音设置表
CREATE TABLE voice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'fish-audio',
    api_url TEXT NOT NULL DEFAULT 'https://api.fish.audio',
    api_key TEXT NOT NULL DEFAULT '',
    reading_mode VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (reading_mode IN ('all', 'dialogue-only')),
    default_voice_model_id UUID,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 确保每个用户只有一个语音设置
    UNIQUE(user_id)
);

-- 添加表注释
COMMENT ON TABLE voice_settings IS '用户语音设置表';
COMMENT ON COLUMN voice_settings.provider IS '语音服务提供商';
COMMENT ON COLUMN voice_settings.api_url IS 'API服务地址';
COMMENT ON COLUMN voice_settings.api_key IS 'API密钥';
COMMENT ON COLUMN voice_settings.reading_mode IS '阅读模式：all-全部，dialogue-only-仅对话';
COMMENT ON COLUMN voice_settings.default_voice_model_id IS '默认语音模型ID';
COMMENT ON COLUMN voice_settings.model_version IS '模型版本';

-- 添加索引
CREATE INDEX idx_voice_settings_user_id ON voice_settings(user_id);

-- 设置RLS策略
ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的语音设置
CREATE POLICY "Users can view own voice settings" ON voice_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice settings" ON voice_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice settings" ON voice_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own voice settings" ON voice_settings
    FOR DELETE USING (auth.uid() = user_id);

-- 授权访问
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_settings TO authenticated;
GRANT SELECT ON voice_settings TO anon;
```

### 6. 新增 VoiceModel 表

**创建表结构**：
```sql
-- 创建语音模型表
CREATE TABLE voice_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    tags JSONB DEFAULT '[]',
    user_note TEXT,
    is_preset BOOLEAN DEFAULT false,
    model_id VARCHAR(255), -- 外部模型ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE voice_models IS '语音模型表';
COMMENT ON COLUMN voice_models.user_id IS '用户ID，预设模型为NULL';
COMMENT ON COLUMN voice_models.name IS '模型名称';
COMMENT ON COLUMN voice_models.description IS '模型描述';
COMMENT ON COLUMN voice_models.author IS '模型作者';
COMMENT ON COLUMN voice_models.tags IS '模型标签数组';
COMMENT ON COLUMN voice_models.user_note IS '用户备注';
COMMENT ON COLUMN voice_models.is_preset IS '是否为预设模型';
COMMENT ON COLUMN voice_models.model_id IS '外部服务的模型ID';

-- 添加索引
CREATE INDEX idx_voice_models_user_id ON voice_models(user_id);
CREATE INDEX idx_voice_models_preset ON voice_models(is_preset);
CREATE INDEX idx_voice_models_model_id ON voice_models(model_id);

-- 设置RLS策略
ALTER TABLE voice_models ENABLE ROW LEVEL SECURITY;

-- 用户可以查看预设模型和自己的模型
CREATE POLICY "Users can view preset and own voice models" ON voice_models
    FOR SELECT USING (is_preset = true OR auth.uid() = user_id);

-- 用户只能插入自己的模型
CREATE POLICY "Users can insert own voice models" ON voice_models
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_preset = false);

-- 用户只能更新自己的模型
CREATE POLICY "Users can update own voice models" ON voice_models
    FOR UPDATE USING (auth.uid() = user_id AND is_preset = false);

-- 用户只能删除自己的模型
CREATE POLICY "Users can delete own voice models" ON voice_models
    FOR DELETE USING (auth.uid() = user_id AND is_preset = false);

-- 授权访问
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_models TO authenticated;
GRANT SELECT ON voice_models TO anon;

-- 插入预设语音模型
INSERT INTO voice_models (id, name, description, is_preset, model_id) VALUES
('59cb5986-6715-46ea-a6ca-8ae6f29f6d22', '央视配音', '专业新闻播报风格', true, '59cb5986671546eaa6ca8ae6f29f6d22'),
('faccba1a-8ac5-4016-bcfc-02761285e67f', '电台女声', '温柔电台主播风格', true, 'faccba1a8ac54016bcfc02761285e67f');
```

## 🔄 数据迁移策略

### 1. 现有数据兼容性

**ChatMessage 表**：
- `versions` 字段默认为空数组，现有消息保持兼容
- `current_version_index` 默认为0，指向原始内容
- `is_streaming` 和 `is_reasoning_complete` 默认值确保现有消息正常显示

**ChatSession 表**：
- `is_hidden` 和 `is_pinned` 默认为false，现有会话保持原有状态

**AIRole 表**：
- `opening_messages` 默认为空数组，可后续配置
- 外键字段允许NULL，不影响现有角色

### 2. 数据同步更新

**DataSyncService 更新**：
```typescript
// 需要更新的同步字段映射
const FIELD_MAPPINGS = {
  ChatMessage: {
    versions: 'versions',
    currentVersionIndex: 'current_version_index',
    isStreaming: 'is_streaming',
    isReasoningComplete: 'is_reasoning_complete'
  },
  ChatSession: {
    isHidden: 'is_hidden',
    isPinned: 'is_pinned'
  },
  AIRole: {
    openingMessages: 'opening_messages',
    currentOpeningIndex: 'current_opening_index',
    globalPromptId: 'global_prompt_id',
    voiceModelId: 'voice_model_id'
  },
  LLMConfig: {
    proxyUrl: 'proxy_url',
    enabled: 'enabled'
  }
};
```

## 📅 实施计划

### 阶段一：核心字段更新（高优先级）
1. **ChatMessage 表更新** - 支持消息版本管理
2. **ChatSession 表更新** - 支持会话状态管理
3. **测试现有功能兼容性**

### 阶段二：扩展功能支持（中优先级）
1. **AIRole 表更新** - 支持开场白和语音设置
2. **LLMConfig 表更新** - 支持代理和启用状态
3. **更新DataSyncService字段映射**

### 阶段三：语音功能完整支持（新功能）
1. **创建VoiceSettings表** - 用户语音设置
2. **创建VoiceModel表** - 语音模型管理
3. **实现语音数据同步逻辑**
4. **全面测试语音功能**

## ⚠️ 注意事项

### 1. 数据安全
- 所有表更新操作建议在维护窗口执行
- 执行前务必备份现有数据
- 分阶段执行，每阶段后验证数据完整性

### 2. 性能考虑
- 新增字段使用合适的默认值，避免大量数据更新
- 添加必要的索引优化查询性能
- JSONB字段使用适当的GIN索引（如需要）

### 3. 应用兼容性
- 前端代码需要同步更新以支持新字段
- DataSyncService需要更新字段映射逻辑
- 确保新旧版本应用的兼容性

## 🧪 测试验证

### 1. 数据完整性测试
- 验证所有现有数据在更新后保持完整
- 测试新字段的默认值是否正确
- 验证外键约束和索引是否正常工作

### 2. 功能测试
- 测试消息版本管理功能
- 测试会话置顶和隐藏功能
- 测试AI角色开场白功能
- 测试语音设置和模型管理

### 3. 性能测试
- 验证新增索引对查询性能的影响
- 测试大量数据场景下的性能表现
- 监控数据库资源使用情况

## 📊 预期效果

更新完成后，系统将实现：

✅ **完整的云端数据同步** - 所有本地功能状态都能同步到云端

✅ **增强的消息管理** - 支持消息版本控制和编辑历史

✅ **灵活的会话管理** - 支持会话置顶、隐藏等状态管理

✅ **丰富的AI角色功能** - 支持开场白和语音个性化设置

✅ **完整的语音功能** - 支持语音设置和模型的云端同步

✅ **更好的用户体验** - 跨设备数据一致性和功能完整性