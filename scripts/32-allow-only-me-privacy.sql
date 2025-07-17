-- Migration to update posts.privacy check constraint to allow 'only_me'

-- Drop existing check constraint on privacy column
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_privacy_check;

-- Add new check constraint including 'only_me'
ALTER TABLE posts ADD CONSTRAINT posts_privacy_check CHECK (privacy IN ('public', 'followers', 'private', 'only_me'));
