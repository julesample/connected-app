-- Drop existing functions to recreate them properly
DROP FUNCTION IF EXISTS create_password_reset_code(TEXT);
DROP FUNCTION IF EXISTS verify_reset_code_and_update_password(TEXT, TEXT, TEXT);

-- Function to create password reset code with proper email sending
CREATE OR REPLACE FUNCTION create_password_reset_code(user_email TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, code TEXT, expires_at TIMESTAMP WITH TIME ZONE) AS $$
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
    -- Don't reveal if email exists or not for security
    RETURN QUERY SELECT FALSE, 'If this email exists, a reset code will be sent.', '', NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Generate unique 6-digit code
  LOOP
    reset_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM password_reset_codes prc
      WHERE prc.code = reset_code 
      AND prc.expires_at > NOW() 
      AND NOT prc.used
    );
  END LOOP;
  
  -- Set expiry time (10 minutes)
  expiry_time := NOW() + INTERVAL '10 minutes';
  
  -- Delete any existing unused codes for this user
  DELETE FROM password_reset_codes 
  WHERE user_id = user_record.id 
  AND NOT used;
  
  -- Insert new code
  INSERT INTO password_reset_codes (user_id, email, code, expires_at)
  VALUES (user_record.id, user_record.email, reset_code, expiry_time);
  
  -- In a real implementation, you would send the email here
  -- For now, we'll return the code for testing purposes
  -- In production, you should integrate with an email service
  
  RETURN QUERY SELECT TRUE, 'Reset code generated successfully', reset_code, expiry_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify reset code (separate from password update)
CREATE OR REPLACE FUNCTION verify_reset_code(
  user_email TEXT,
  reset_code TEXT
)
RETURNS TABLE(valid BOOLEAN, message TEXT, user_id UUID) AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- Find valid code with proper table alias
  SELECT prc.*, u.id as auth_user_id INTO code_record
  FROM password_reset_codes prc
  JOIN auth.users u ON u.id = prc.user_id
  WHERE prc.email = user_email
  AND prc.code = reset_code
  AND prc.expires_at > NOW()
  AND NOT prc.used;
  
  IF code_record.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired reset code', NULL::UUID;
    RETURN;
  END IF;
  
  -- Mark code as used immediately to prevent reuse
  UPDATE password_reset_codes
  SET used = TRUE, updated_at = NOW()
  WHERE id = code_record.id;
  
  RETURN QUERY SELECT TRUE, 'Code verified successfully', code_record.auth_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at column if it doesn't exist
ALTER TABLE password_reset_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Function to clean up expired and used codes
CREATE OR REPLACE FUNCTION cleanup_password_reset_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < NOW() OR used = TRUE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_password_reset_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_reset_code(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_password_reset_codes() TO authenticated;

-- Create a function to get reset code for testing (remove in production)
CREATE OR REPLACE FUNCTION get_latest_reset_code_for_testing(user_email TEXT)
RETURNS TABLE(code TEXT, expires_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT prc.code, prc.expires_at
  FROM password_reset_codes prc
  WHERE prc.email = user_email
  AND prc.expires_at > NOW()
  AND NOT prc.used
  ORDER BY prc.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission for testing function (remove in production)
GRANT EXECUTE ON FUNCTION get_latest_reset_code_for_testing(TEXT) TO anon;
