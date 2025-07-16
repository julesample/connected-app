-- Update messages policies to prevent blocked users from messaging
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;

CREATE POLICY "Users can send messages to non-blocked users" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id 
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    ) AND
    NOT EXISTS (
      SELECT 1 FROM blocks b
      JOIN conversations c ON c.id = conversation_id
      WHERE (
        (b.blocker_id = auth.uid() AND b.blocked_id = CASE WHEN c.participant1_id = auth.uid() THEN c.participant2_id ELSE c.participant1_id END) OR
        (b.blocked_id = auth.uid() AND b.blocker_id = CASE WHEN c.participant1_id = auth.uid() THEN c.participant2_id ELSE c.participant1_id END)
      )
    )
  );

-- Update conversations policies to prevent blocked users from creating conversations
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

CREATE POLICY "Users can create conversations with non-blocked users" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant1_id OR auth.uid() = participant2_id) AND
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = participant1_id AND blocked_id = participant2_id)
         OR (blocker_id = participant2_id AND blocked_id = participant1_id)
    )
  );

-- Update messages view policy to hide messages from blocked users
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;

CREATE POLICY "Users can view messages from non-blocked users" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id 
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    ) AND
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = auth.uid() AND blocked_id = sender_id)
         OR (blocker_id = sender_id AND blocked_id = auth.uid())
    )
  );

-- Update conversations view policy to hide conversations with blocked users
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;

CREATE POLICY "Users can view conversations with non-blocked users" ON conversations
  FOR SELECT USING (
    (auth.uid() = participant1_id OR auth.uid() = participant2_id) AND
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = participant1_id AND blocked_id = participant2_id)
         OR (blocker_id = participant2_id AND blocked_id = participant1_id)
    )
  );
