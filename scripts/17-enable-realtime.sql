-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable realtime for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable realtime for notifications table (if it exists)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Grant necessary permissions for realtime
GRANT SELECT ON messages TO authenticated;
GRANT SELECT ON conversations TO authenticated;

-- Create a function to check realtime status
CREATE OR REPLACE FUNCTION check_realtime_status()
RETURNS TABLE(table_name text, realtime_enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    CASE WHEN p.pubname IS NOT NULL THEN true ELSE false END as realtime_enabled
  FROM information_schema.tables t
  LEFT JOIN pg_publication_tables p ON p.tablename = t.table_name AND p.pubname = 'supabase_realtime'
  WHERE t.table_schema = 'public' 
  AND t.table_name IN ('messages', 'conversations', 'notifications')
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql;

-- Check the status
SELECT * FROM check_realtime_status();
