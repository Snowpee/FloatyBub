-- Create user_roles table for role-playing functionality
-- This is separate from user_profiles which stores actual user account information

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_created_at ON public.user_roles(created_at);

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own roles
CREATE POLICY "Users can insert their own roles" ON public.user_roles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own roles
CREATE POLICY "Users can update their own roles" ON public.user_roles
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own roles
CREATE POLICY "Users can delete their own roles" ON public.user_roles
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL PRIVILEGES ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();