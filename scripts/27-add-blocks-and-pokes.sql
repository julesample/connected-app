-- Create blocks table
CREATE TABLE IF NOT EXISTS blocks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- Create pokes table
CREATE TABLE IF NOT EXISTS pokes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  poked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poker_id, poked_id),
  CHECK (poker_id != poked_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS blocks_blocker_id_idx ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_id_idx ON blocks(blocked_id);
CREATE INDEX IF NOT EXISTS pokes_poker_id_idx ON pokes(poker_id);
CREATE INDEX IF NOT EXISTS pokes_poked_id_idx ON pokes(poked_id);
CREATE INDEX IF NOT EXISTS pokes_created_at_idx ON pokes(created_at DESC);

-- Enable RLS
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokes ENABLE ROW LEVEL SECURITY;

-- Blocks policies
CREATE POLICY "Users can view their own blocks" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Pokes policies
CREATE POLICY "Users can view pokes they sent or received" ON pokes
  FOR SELECT USING (auth.uid() = poker_id OR auth.uid() = poked_id);

CREATE POLICY "Users can create pokes" ON pokes
  FOR INSERT WITH CHECK (auth.uid() = poker_id);

CREATE POLICY "Users can delete pokes they sent" ON pokes
  FOR DELETE USING (auth.uid() = poker_id);

-- Function to check if user is blocked
CREATE OR REPLACE FUNCTION is_user_blocked(user_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocks 
    WHERE (blocker_id = user_id AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's poke status
CREATE OR REPLACE FUNCTION get_poke_status(user_id UUID, target_user_id UUID)
RETURNS TABLE(has_poked BOOLEAN, poke_count INTEGER, last_poke TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM pokes WHERE poker_id = user_id AND poked_id = target_user_id) as has_poked,
    (SELECT COUNT(*)::INTEGER FROM pokes WHERE poked_id = target_user_id) as poke_count,
    (SELECT MAX(created_at) FROM pokes WHERE poker_id = user_id AND poked_id = target_user_id) as last_poke;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_user_blocked(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_poke_status(UUID, UUID) TO authenticated;

-- Enable realtime for blocks and pokes
ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE pokes;
GRANT SELECT ON blocks TO authenticated;
GRANT SELECT ON pokes TO authenticated;

-- Add poke notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('like', 'comment', 'follow', 'poke'));

-- Function to create poke notification
CREATE OR REPLACE FUNCTION create_poke_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type)
  VALUES (NEW.poked_id, NEW.poker_id, 'poke');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for poke notifications
DROP TRIGGER IF EXISTS poke_notification_trigger ON pokes;
CREATE TRIGGER poke_notification_trigger
  AFTER INSERT ON pokes
  FOR EACH ROW EXECUTE FUNCTION create_poke_notification();
