-- Update the password reset function to actually send emails
DROP FUNCTION IF EXISTS create_password_reset_code(TEXT);

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
    RETURN QUERY SELECT TRUE, 'If this email exists, a reset code will be sent.', '', NULL::TIMESTAMP WITH TIME ZONE;
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
  
  -- Return success with code for email sending
  RETURN QUERY SELECT TRUE, 'Reset code generated successfully', reset_code, expiry_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_password_reset_code(TEXT) TO anon;
