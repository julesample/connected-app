-- Create a function to check for vulgar content
CREATE OR REPLACE FUNCTION contains_vulgar_content(content TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  vulgar_words TEXT[] := ARRAY[
    'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'crap',
    'piss', 'slut', 'whore', 'faggot', 'nigger', 'retard', 'gay',
    'stupid', 'idiot', 'moron', 'dumb', 'kill yourself', 'kys'
  ];
  word TEXT;
  clean_content TEXT;
BEGIN
  -- Convert to lowercase and remove special characters for checking
  clean_content := lower(regexp_replace(content, '[^a-zA-Z0-9\s]', ' ', 'g'));
  
  -- Check each vulgar word
  FOREACH word IN ARRAY vulgar_words
  LOOP
    IF clean_content LIKE '%' || word || '%' THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Update posts table to add moderation
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

-- Update comments table to add moderation
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

-- Update messages table to add moderation
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

-- Function to moderate content before insert/update
CREATE OR REPLACE FUNCTION moderate_content()
RETURNS TRIGGER AS $$
BEGIN
  IF contains_vulgar_content(NEW.content) THEN
    NEW.is_flagged := TRUE;
    NEW.flagged_reason := 'Contains inappropriate language';
    -- You can choose to reject the content entirely by raising an exception
    -- RAISE EXCEPTION 'Content contains inappropriate language and cannot be posted.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add moderation triggers
DROP TRIGGER IF EXISTS moderate_posts_trigger ON posts;
CREATE TRIGGER moderate_posts_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION moderate_content();

DROP TRIGGER IF EXISTS moderate_comments_trigger ON comments;
CREATE TRIGGER moderate_comments_trigger
  BEFORE INSERT OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION moderate_content();

DROP TRIGGER IF EXISTS moderate_messages_trigger ON messages;
CREATE TRIGGER moderate_messages_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION moderate_content();

-- Function to clean up old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up notifications when related content is deleted
CREATE OR REPLACE FUNCTION cleanup_related_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    DELETE FROM notifications WHERE post_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    DELETE FROM notifications WHERE comment_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    DELETE FROM notifications WHERE message_id = OLD.id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add cleanup triggers
DROP TRIGGER IF EXISTS cleanup_post_notifications ON posts;
CREATE TRIGGER cleanup_post_notifications
  AFTER DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION cleanup_related_notifications();

DROP TRIGGER IF EXISTS cleanup_comment_notifications ON comments;
CREATE TRIGGER cleanup_comment_notifications
  AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION cleanup_related_notifications();

DROP TRIGGER IF EXISTS cleanup_message_notifications ON messages;
CREATE TRIGGER cleanup_message_notifications
  AFTER DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION cleanup_related_notifications();

-- Create a scheduled job to clean up old notifications (run daily)
-- Note: This requires pg_cron extension which may not be available in all environments
-- You can run this manually or set up a cron job externally
CREATE OR REPLACE FUNCTION schedule_notification_cleanup()
RETURNS void AS $$
BEGIN
  -- This would ideally be scheduled, but for now we'll create the function
  -- You can call this manually: SELECT schedule_notification_cleanup();
  PERFORM cleanup_old_notifications();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_old_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_notification_cleanup() TO authenticated;
