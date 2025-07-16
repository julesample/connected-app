-- Create table for password reset codes
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS password_reset_codes_user_id_idx ON password_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS password_reset_codes_email_idx ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS password_reset_codes_expires_idx ON password_reset_codes(expires_at);
CREATE INDEX IF NOT EXISTS password_reset_codes_code_idx ON password_reset_codes(code);

-- Enable RLS
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Policies for password reset codes
CREATE POLICY "Users can view their own reset codes" ON password_reset_codes
  FOR SELECT USING (auth.uid() = user_id);

-- Function to generate a 6-digit code
CREATE OR REPLACE FUNCTION generate_reset_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create password reset code
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
      SELECT 1 FROM password_reset_codes 
      WHERE code = reset_code 
      AND expires_at > NOW() 
      AND NOT used
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

-- Function to verify reset code and allow password change
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
  -- Find valid code
  SELECT * INTO code_record
  FROM password_reset_codes
  WHERE email = user_email
  AND code = reset_code
  AND expires_at > NOW()
  AND NOT used;
  
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
  
  -- Update user password (this requires admin privileges)
  -- In a real implementation, you'd use Supabase admin API
  -- For now, we'll return true to indicate the code is valid
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_reset_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_password_reset_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_reset_code_and_update_password(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_reset_codes() TO authenticated;
