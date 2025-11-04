-- Add is_favorite field to ai_roles table
-- This field will track whether a user has marked an AI role as favorite

ALTER TABLE ai_roles 
ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;

-- Add index for better query performance when filtering favorite roles
CREATE INDEX idx_ai_roles_is_favorite ON ai_roles(user_id, is_favorite) WHERE is_favorite = true;

-- Add comment to document the field
COMMENT ON COLUMN ai_roles.is_favorite IS 'Indicates whether the AI role is marked as favorite by the user';