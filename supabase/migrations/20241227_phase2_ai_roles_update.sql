-- Phase 2: AI Roles Table Enhancement
-- Add opening_messages, current_opening_index, global_prompt_id, voice_model_id fields to ai_roles table

-- Add opening_messages field (JSONB array for multiple opening messages)
ALTER TABLE ai_roles 
ADD COLUMN IF NOT EXISTS opening_messages JSONB DEFAULT '[]'::jsonb;

-- Add comment for opening_messages
COMMENT ON COLUMN ai_roles.opening_messages IS '开场白消息数组';

-- Add current_opening_index field (integer for current opening message index)
ALTER TABLE ai_roles 
ADD COLUMN IF NOT EXISTS current_opening_index INTEGER DEFAULT 0;

-- Add comment for current_opening_index
COMMENT ON COLUMN ai_roles.current_opening_index IS '当前开场白索引';

-- Add global_prompt_id field (UUID reference to global_prompts table)
ALTER TABLE ai_roles 
ADD COLUMN IF NOT EXISTS global_prompt_id UUID;

-- Add comment for global_prompt_id
COMMENT ON COLUMN ai_roles.global_prompt_id IS '关联的全局提示词ID';

-- Add voice_model_id field (UUID for voice model reference)
ALTER TABLE ai_roles 
ADD COLUMN IF NOT EXISTS voice_model_id UUID;

-- Add comment for voice_model_id
COMMENT ON COLUMN ai_roles.voice_model_id IS '关联的语音模型ID';

-- Create foreign key constraint for global_prompt_id
ALTER TABLE ai_roles 
ADD CONSTRAINT fk_ai_roles_global_prompt 
FOREIGN KEY (global_prompt_id) REFERENCES global_prompts(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_roles_global_prompt_id ON ai_roles(global_prompt_id);
CREATE INDEX IF NOT EXISTS idx_ai_roles_voice_model_id ON ai_roles(voice_model_id);

-- Update existing records with default values
UPDATE ai_roles 
SET 
    opening_messages = '[]'::jsonb,
    current_opening_index = 0
WHERE opening_messages IS NULL OR current_opening_index IS NULL;

-- Verify the changes
DO $$
BEGIN
    -- Check if all new columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_roles' 
        AND column_name IN ('opening_messages', 'current_opening_index', 'global_prompt_id', 'voice_model_id')
        GROUP BY table_name
        HAVING COUNT(*) = 4
    ) THEN
        RAISE EXCEPTION 'Phase 2 migration failed: Not all columns were added to ai_roles table';
    END IF;
    
    RAISE NOTICE 'Phase 2 migration completed successfully: ai_roles table updated';
END $$;