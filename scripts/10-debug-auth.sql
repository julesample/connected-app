-- Enable logging for debugging
SET log_statement = 'all';
SET log_min_messages = 'log';

-- Check current auth users and profiles
SELECT 'Auth Users Count:' as info, COUNT(*) as count FROM auth.users;
SELECT 'Profiles Count:' as info, COUNT(*) as count FROM profiles;

-- Check if there are any orphaned auth users without profiles
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.id as profile_id
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Check the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
