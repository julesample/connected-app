-- Remove the message notification trigger
DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
DROP FUNCTION IF EXISTS create_message_notification();

-- Remove existing message notifications
DELETE FROM notifications WHERE type = 'message';

-- Update the notification types check constraint to remove 'message'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('like', 'comment', 'follow'));
