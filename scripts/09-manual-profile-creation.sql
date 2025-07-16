-- Create a function that can be called manually to create profiles
CREATE OR REPLACE FUNCTION create_profile_for_user(
  user_id UUID,
  user_email TEXT,
  user_username TEXT DEFAULT NULL,
  user_full_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name)
  VALUES (
    user_id,
    COALESCE(user_username, split_part(user_email, '@', 1)),
    COALESCE(user_full_name, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(user_username, split_part(user_email, '@', 1)),
    full_name = COALESCE(user_full_name, '');
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in create_profile_for_user: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_profile_for_user TO authenticated;
