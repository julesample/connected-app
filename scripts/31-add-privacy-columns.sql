-- Add is_private column to profiles table
ALTER TABLE profiles
ADD COLUMN is_private BOOLEAN DEFAULT FALSE;

-- Add allowed_users column to posts table
ALTER TABLE posts
ADD COLUMN allowed_users UUID[];

-- Add an index for allowed_users
CREATE INDEX idx_posts_allowed_users ON posts USING GIN (allowed_users);
