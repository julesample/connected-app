-- Enable realtime for all relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Grant necessary permissions for realtime
GRANT SELECT ON posts TO authenticated;
GRANT SELECT ON comments TO authenticated;
GRANT SELECT ON likes TO authenticated;
GRANT SELECT ON follows TO authenticated;
GRANT SELECT ON profiles TO authenticated;

-- Create a comprehensive realtime status check
CREATE OR REPLACE FUNCTION check_all_realtime_status()
RETURNS TABLE(table_name text, realtime_enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    CASE WHEN p.pubname IS NOT NULL THEN true ELSE false END as realtime_enabled
  FROM information_schema.tables t
  LEFT JOIN pg_publication_tables p ON p.tablename = t.table_name AND p.pubname = 'supabase_realtime'
  WHERE t.table_schema = 'public' 
  AND t.table_name IN ('posts', 'comments', 'likes', 'follows', 'profiles', 'messages', 'conversations', 'notifications')
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql;

-- Check the status of all tables
SELECT * FROM check_all_realtime_status();

-- Create a function to manually trigger notification cleanup
CREATE OR REPLACE FUNCTION manual_cleanup_notifications()
RETURNS TEXT AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT cleanup_old_notifications() INTO deleted_count;
  RETURN 'Cleaned up ' || deleted_count || ' old notifications';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION manual_cleanup_notifications() TO authenticated;
