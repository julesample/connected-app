-- Add deletion request tracking to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE;

-- Create a table to track conversation deletion requests
CREATE TABLE IF NOT EXISTS conversation_deletion_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  requested_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(conversation_id, requested_by)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS conversation_deletion_requests_conversation_idx ON conversation_deletion_requests(conversation_id);
CREATE INDEX IF NOT EXISTS conversation_deletion_requests_expires_idx ON conversation_deletion_requests(expires_at);

-- Enable RLS
ALTER TABLE conversation_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policies for deletion requests
CREATE POLICY "Users can view deletion requests for their conversations" ON conversation_deletion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id 
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
  );

CREATE POLICY "Users can create deletion requests for their conversations" ON conversation_deletion_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id 
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete their own deletion requests" ON conversation_deletion_requests
  FOR DELETE USING (auth.uid() = requested_by);

-- Function to handle conversation deletion approval
CREATE OR REPLACE FUNCTION approve_conversation_deletion(conv_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  other_user_id UUID;
  existing_request RECORD;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  -- Get the other participant
  SELECT 
    CASE 
      WHEN participant1_id = current_user_id THEN participant2_id
      ELSE participant1_id
    END INTO other_user_id
  FROM conversations
  WHERE id = conv_id
  AND (participant1_id = current_user_id OR participant2_id = current_user_id);
  
  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;
  
  -- Check if there's a pending deletion request from the other user
  SELECT * INTO existing_request
  FROM conversation_deletion_requests
  WHERE conversation_id = conv_id
  AND requested_by = other_user_id
  AND expires_at > NOW();
  
  IF existing_request.id IS NOT NULL THEN
    -- Both users agree, delete the conversation
    DELETE FROM conversations WHERE id = conv_id;
    RETURN TRUE;
  ELSE
    -- Create or update deletion request from current user
    INSERT INTO conversation_deletion_requests (conversation_id, requested_by)
    VALUES (conv_id, current_user_id)
    ON CONFLICT (conversation_id, requested_by) 
    DO UPDATE SET 
      requested_at = NOW(),
      expires_at = NOW() + INTERVAL '7 days';
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel conversation deletion request
CREATE OR REPLACE FUNCTION cancel_conversation_deletion(conv_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  DELETE FROM conversation_deletion_requests
  WHERE conversation_id = conv_id
  AND requested_by = current_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired deletion requests
CREATE OR REPLACE FUNCTION cleanup_expired_deletion_requests()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM conversation_deletion_requests
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_conversation_deletion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_conversation_deletion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_deletion_requests() TO authenticated;

-- Enable realtime for deletion requests
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_deletion_requests;
GRANT SELECT ON conversation_deletion_requests TO authenticated;
