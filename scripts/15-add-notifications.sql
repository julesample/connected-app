-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'message')),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to create notification for likes
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't create notification if user likes their own post
  IF NEW.user_id != (SELECT user_id FROM posts WHERE id = NEW.post_id) THEN
    INSERT INTO notifications (user_id, actor_id, type, post_id)
    VALUES (
      (SELECT user_id FROM posts WHERE id = NEW.post_id),
      NEW.user_id,
      'like',
      NEW.post_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for comments
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't create notification if user comments on their own post
  IF NEW.user_id != (SELECT user_id FROM posts WHERE id = NEW.post_id) THEN
    INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id)
    VALUES (
      (SELECT user_id FROM posts WHERE id = NEW.post_id),
      NEW.user_id,
      'comment',
      NEW.post_id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for follows
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for messages
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
BEGIN
  -- Get the recipient (the other participant in the conversation)
  SELECT CASE 
    WHEN participant1_id = NEW.sender_id THEN participant2_id
    ELSE participant1_id
  END INTO recipient_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  INSERT INTO notifications (user_id, actor_id, type, message_id)
  VALUES (recipient_id, NEW.sender_id, 'message', NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for notifications
DROP TRIGGER IF EXISTS like_notification_trigger ON likes;
CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION create_like_notification();

DROP TRIGGER IF EXISTS comment_notification_trigger ON comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION create_comment_notification();

DROP TRIGGER IF EXISTS follow_notification_trigger ON follows;
CREATE TRIGGER follow_notification_trigger
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION create_follow_notification();

DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION create_message_notification();

-- Function to clean up old notifications (optional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
