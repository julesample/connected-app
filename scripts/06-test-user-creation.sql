-- Test the user creation process
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
BEGIN
  -- Simulate what happens when a user signs up
  INSERT INTO auth.users (
    id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    created_at, 
    updated_at,
    raw_user_meta_data
  ) VALUES (
    test_user_id,
    'test@example.com',
    'encrypted_password_here',
    NOW(),
    NOW(),
    NOW(),
    '{"username": "testuser", "fullName": "Test User"}'::jsonb
  );
  
  -- Check if profile was created
  IF EXISTS (SELECT 1 FROM profiles WHERE id = test_user_id) THEN
    RAISE NOTICE 'Profile created successfully for test user';
    -- Clean up test data
    DELETE FROM profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;
  ELSE
    RAISE NOTICE 'Profile creation failed for test user';
  END IF;
END $$;
