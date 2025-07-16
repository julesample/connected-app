-- Update RLS policies to be more permissive for profile creation
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- More permissive policies for profile management
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    auth.role() = 'service_role'
  );

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    auth.role() = 'service_role'
  );

-- Allow authenticated users to read all profiles
CREATE POLICY "Authenticated users can read profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
