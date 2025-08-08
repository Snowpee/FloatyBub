-- Phase 2: LLM Configs Table Enhancement
-- Add proxy_url, enabled fields to llm_configs table

-- Add proxy_url field (TEXT for proxy server URL)
ALTER TABLE llm_configs 
ADD COLUMN IF NOT EXISTS proxy_url TEXT;

-- Add comment for proxy_url
COMMENT ON COLUMN llm_configs.proxy_url IS '代理服务器URL';

-- Add enabled field (BOOLEAN for configuration status)
ALTER TABLE llm_configs 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

-- Add comment for enabled
COMMENT ON COLUMN llm_configs.enabled IS '配置是否启用';

-- Create index for enabled field for better query performance
CREATE INDEX IF NOT EXISTS idx_llm_configs_enabled ON llm_configs(enabled);

-- Update existing records with default values
UPDATE llm_configs 
SET enabled = true
WHERE enabled IS NULL;

-- Verify the changes
DO $$
BEGIN
    -- Check if all new columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'llm_configs' 
        AND column_name IN ('proxy_url', 'enabled')
        GROUP BY table_name
        HAVING COUNT(*) = 2
    ) THEN
        RAISE EXCEPTION 'Phase 2 LLM configs migration failed: Not all columns were added to llm_configs table';
    END IF;
    
    RAISE NOTICE 'Phase 2 LLM configs migration completed successfully: llm_configs table updated';
END $$;