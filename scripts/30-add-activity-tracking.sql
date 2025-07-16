-- Create user activity tracking table
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('follow', 'unfollow', 'block', 'unblock', 'poke', 'unpoke', 'like', 'unlike', 'comment', 'message')),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_activities_user_id_idx ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS user_activities_target_user_id_idx ON user_activities(target_user_id);
CREATE INDEX IF NOT EXISTS user_activities_type_idx ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS user_activities_created_at_idx ON user_activities(created_at DESC);

-- Enable RLS
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Policies for user activities
CREATE POLICY "Users can view their own activities" ON user_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities" ON user_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  activity_type TEXT,
  target_user_id UUID DEFAULT NULL,
  details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_activities (user_id, target_user_id, activity_type, details)
  VALUES (auth.uid(), target_user_id, activity_type, details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION log_user_activity(TEXT, UUID, JSONB) TO authenticated;

-- Function to get blocked users with activity details
CREATE OR REPLACE FUNCTION get_blocked_users_with_activity()
RETURNS TABLE(
  blocked_user_id UUID,
  blocked_username TEXT,
  blocked_full_name TEXT,
  blocked_avatar_url TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE,
  block_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    b.created_at,
    COALESCE((ua.details->>'reason')::TEXT, 'No reason provided') as reason
  FROM blocks b
  JOIN profiles p ON p.id = b.blocked_id
  LEFT JOIN user_activities ua ON ua.target_user_id = b.blocked_id 
    AND ua.activity_type = 'block' 
    AND ua.user_id = b.blocker_id
    AND ua.created_at = (
      SELECT MAX(created_at) 
      FROM user_activities 
      WHERE target_user_id = b.blocked_id 
      AND activity_type = 'block' 
      AND user_id = b.blocker_id
    )
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_blocked_users_with_activity() TO authenticated;

-- Function to unblock user with activity logging
CREATE OR REPLACE FUNCTION unblock_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  -- Delete the block
  DELETE FROM blocks 
  WHERE blocker_id = current_user_id 
  AND blocked_id = target_user_id;
  
  -- Log the activity
  PERFORM log_user_activity('unblock', target_user_id, '{"action": "unblocked_user"}'::jsonb);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION unblock_user(UUID) TO authenticated;

-- Enable realtime for user activities
ALTER PUBLICATION supabase_realtime ADD TABLE user_activities;
GRANT SELECT ON user_activities TO authenticated;
