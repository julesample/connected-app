-- Drop and recreate the password reset function with proper column qualification
DROP FUNCTION IF EXISTS create_password_reset_code(TEXT);

-- Function to create password reset code (fixed)
CREATE OR REPLACE FUNCTION create_password_reset_code(user_email TEXT)
RETURNS TABLE(code TEXT, expires_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  user_record RECORD;
  reset_code TEXT;
  expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Find user by email
  SELECT id, email INTO user_record
  FROM auth.users
  WHERE email = user_email
  AND email_confirmed_at IS NOT NULL;
  
  IF user_record.id IS NULL THEN
    RAISE EXCEPTION 'User not found or email not confirmed';
  END IF;
  
  -- Generate unique code
  LOOP
    reset_code := generate_reset_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM password_reset_codes prc
      WHERE prc.code = reset_code 
      AND prc.expires_at > NOW() 
      AND NOT prc.used
    );
  END LOOP;
  
  -- Set expiry time
  expiry_time := NOW() + INTERVAL '10 minutes';
  
  -- Delete any existing unused codes for this user
  DELETE FROM password_reset_codes 
  WHERE user_id = user_record.id 
  AND NOT used;
  
  -- Insert new code
  INSERT INTO password_reset_codes (user_id, email, code, expires_at)
  VALUES (user_record.id, user_record.email, reset_code, expiry_time);
  
  RETURN QUERY SELECT reset_code, expiry_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the verify function
DROP FUNCTION IF EXISTS verify_reset_code_and_update_password(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION verify_reset_code_and_update_password(
  user_email TEXT,
  reset_code TEXT,
  new_password TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
  user_record RECORD;
BEGIN
  -- Find valid code with proper table alias
  SELECT prc.* INTO code_record
  FROM password_reset_codes prc
  WHERE prc.email = user_email
  AND prc.code = reset_code
  AND prc.expires_at > NOW()
  AND NOT prc.used;
  
  IF code_record.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired reset code';
  END IF;
  
  -- Get user record
  SELECT * INTO user_record
  FROM auth.users
  WHERE id = code_record.user_id;
  
  IF user_record.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Mark code as used
  UPDATE password_reset_codes
  SET used = TRUE
  WHERE id = code_record.id;
  
  -- Return true to indicate the code is valid
  -- The actual password update will be handled by the client
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_password_reset_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_reset_code_and_update_password(TEXT, TEXT, TEXT) TO anon;
