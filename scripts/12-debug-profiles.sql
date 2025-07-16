-- Check if user profiles exist and debug profile creation
SELECT 
  'Auth users without profiles:' as info,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Show recent auth users and their profiles
SELECT 
  u.id,
  u.email,
  u.created_at as user_created,
  p.username,
  p.full_name,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;

-- Test the RPC function manually
SELECT create_profile_for_user(
  (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),
  (SELECT email FROM auth.users ORDER BY created_at DESC LIMIT 1),
  'testuser',
  'Test User'
);
