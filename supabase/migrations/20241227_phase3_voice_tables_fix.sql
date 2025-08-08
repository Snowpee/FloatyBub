-- Phase 3 Fix: Voice Tables Structure Update
-- Update existing voice_settings table and create voice_models table

-- First, create voice_models table if it doesn't exist
CREATE TABLE IF NOT EXISTS voice_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'zh-CN',
    gender VARCHAR(10) DEFAULT 'female',
    sample_rate INTEGER DEFAULT 24000,
    format VARCHAR(20) DEFAULT 'mp3',
    is_premium BOOLEAN DEFAULT false,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments for voice_models table
COMMENT ON TABLE voice_models IS '语音模型配置表';
COMMENT ON COLUMN voice_models.name IS '模型显示名称';
COMMENT ON COLUMN voice_models.provider IS '语音服务提供商';
COMMENT ON COLUMN voice_models.model_id IS '模型标识符';
COMMENT ON COLUMN voice_models.language IS '支持的语言';
COMMENT ON COLUMN voice_models.gender IS '声音性别';
COMMENT ON COLUMN voice_models.sample_rate IS '采样率';
COMMENT ON COLUMN voice_models.format IS '音频格式';
COMMENT ON COLUMN voice_models.is_premium IS '是否为付费模型';
COMMENT ON COLUMN voice_models.description IS '模型描述';
COMMENT ON COLUMN voice_models.metadata IS '额外元数据';

-- Add new columns to existing voice_settings table
ALTER TABLE voice_settings 
ADD COLUMN IF NOT EXISTS voice_model_id UUID REFERENCES voice_models(id) ON DELETE SET NULL;

ALTER TABLE voice_settings 
ADD COLUMN IF NOT EXISTS speed DECIMAL(3,2) DEFAULT 1.0;

ALTER TABLE voice_settings 
ADD COLUMN IF NOT EXISTS pitch DECIMAL(3,2) DEFAULT 1.0;

ALTER TABLE voice_settings 
ADD COLUMN IF NOT EXISTS volume DECIMAL(3,2) DEFAULT 1.0;

ALTER TABLE voice_settings 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

ALTER TABLE voice_settings 
ADD COLUMN IF NOT EXISTS auto_play BOOLEAN DEFAULT false;

-- Add comments for new voice_settings columns
COMMENT ON COLUMN voice_settings.voice_model_id IS '选择的语音模型ID';
COMMENT ON COLUMN voice_settings.speed IS '语音速度';
COMMENT ON COLUMN voice_settings.pitch IS '语音音调';
COMMENT ON COLUMN voice_settings.volume IS '语音音量';
COMMENT ON COLUMN voice_settings.enabled IS '是否启用语音';
COMMENT ON COLUMN voice_settings.auto_play IS '是否自动播放';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_voice_models_provider ON voice_models(provider);
CREATE INDEX IF NOT EXISTS idx_voice_models_language ON voice_models(language);
CREATE INDEX IF NOT EXISTS idx_voice_models_is_premium ON voice_models(is_premium);
CREATE INDEX IF NOT EXISTS idx_voice_settings_voice_model_id ON voice_settings(voice_model_id);
CREATE INDEX IF NOT EXISTS idx_voice_settings_enabled ON voice_settings(enabled);

-- Enable RLS on voice_models table
ALTER TABLE voice_models ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for voice_models (read-only for all authenticated users)
DROP POLICY IF EXISTS "Voice models are viewable by authenticated users" ON voice_models;
CREATE POLICY "Voice models are viewable by authenticated users" ON voice_models
    FOR SELECT USING (auth.role() = 'authenticated');

-- Update existing RLS policies for voice_settings to handle new columns
DROP POLICY IF EXISTS "Users can view their own voice settings" ON voice_settings;
DROP POLICY IF EXISTS "Users can insert their own voice settings" ON voice_settings;
DROP POLICY IF EXISTS "Users can update their own voice settings" ON voice_settings;
DROP POLICY IF EXISTS "Users can delete their own voice settings" ON voice_settings;

CREATE POLICY "Users can view their own voice settings" ON voice_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice settings" ON voice_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice settings" ON voice_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice settings" ON voice_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON voice_models TO anon, authenticated;
GRANT ALL PRIVILEGES ON voice_settings TO authenticated;

-- Insert some default voice models
INSERT INTO voice_models (name, provider, model_id, language, gender, description) VALUES
('小云 (女声)', 'azure', 'zh-CN-XiaoxiaoNeural', 'zh-CN', 'female', 'Azure 中文女声，自然流畅'),
('小晨 (男声)', 'azure', 'zh-CN-YunxiNeural', 'zh-CN', 'male', 'Azure 中文男声，温和亲切'),
('小梦 (女声)', 'azure', 'zh-CN-XiaomengNeural', 'zh-CN', 'female', 'Azure 中文女声，甜美可爱')
ON CONFLICT DO NOTHING;

-- Verify the changes
DO $$
BEGIN
    -- Check if voice_models table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_models') THEN
        RAISE EXCEPTION 'Phase 3 fix migration failed: voice_models table was not created';
    END IF;
    
    -- Check if new columns were added to voice_settings
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_settings' 
        AND column_name IN ('voice_model_id', 'speed', 'pitch', 'volume', 'enabled', 'auto_play')
        GROUP BY table_name
        HAVING COUNT(*) = 6
    ) THEN
        RAISE EXCEPTION 'Phase 3 fix migration failed: Not all columns were added to voice_settings table';
    END IF;
    
    RAISE NOTICE 'Phase 3 fix migration completed successfully: voice tables updated';
END $$;