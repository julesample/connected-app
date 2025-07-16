-- Make sure the profiles table has proper constraints and defaults
ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN full_name SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN bio SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN avatar_url SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN website SET DEFAULT '';

-- Add a check to ensure username is not empty
ALTER TABLE profiles ADD CONSTRAINT username_not_empty CHECK (length(trim(username)) > 0);

-- Create a unique index on username (case insensitive)
DROP INDEX IF EXISTS profiles_username_unique_idx;
CREATE UNIQUE INDEX profiles_username_unique_idx ON profiles (lower(username));

-- Update any existing null values
UPDATE profiles SET 
  full_name = COALESCE(full_name, ''),
  bio = COALESCE(bio, ''),
  avatar_url = COALESCE(avatar_url, ''),
  website = COALESCE(website, '')
WHERE full_name IS NULL OR bio IS NULL OR avatar_url IS NULL OR website IS NULL;
