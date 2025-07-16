-- Remove problematic constraints temporarily
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS username_not_empty;
DROP INDEX IF EXISTS profiles_username_unique_idx;

-- Make username nullable temporarily to avoid issues
ALTER TABLE profiles ALTER COLUMN username DROP NOT NULL;

-- Recreate with simpler constraints
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
