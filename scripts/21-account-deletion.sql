-- Create a function to handle account deletion
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  -- Delete user's data in the correct order to avoid foreign key constraints
  -- The CASCADE deletes should handle most of this, but we'll be explicit
  
  -- Delete notifications related to the user
  DELETE FROM notifications WHERE user_id = current_user_id OR actor_id = current_user_id;
  
  -- Delete messages sent by the user
  DELETE FROM messages WHERE sender_id = current_user_id;
  
  -- Delete conversations where user is a participant
  DELETE FROM conversations WHERE participant1_id = current_user_id OR participant2_id = current_user_id;
  
  -- Delete comments by the user
  DELETE FROM comments WHERE user_id = current_user_id;
  
  -- Delete likes by the user
  DELETE FROM likes WHERE user_id = current_user_id;
  
  -- Delete follows involving the user
  DELETE FROM follows WHERE follower_id = current_user_id OR following_id = current_user_id;
  
  -- Delete posts by the user
  DELETE FROM posts WHERE user_id = current_user_id;
  
  -- Finally, delete the profile
  DELETE FROM profiles WHERE id = current_user_id;
  
  -- Note: The auth.users record should be deleted by the application layer
  -- as it requires admin privileges
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- Create a function to clean up orphaned data (run periodically)
CREATE OR REPLACE FUNCTION cleanup_orphaned_data()
RETURNS TEXT AS $$
DECLARE
  deleted_count INTEGER := 0;
  total_deleted INTEGER := 0;
BEGIN
  -- Clean up notifications for deleted users
  DELETE FROM notifications 
  WHERE user_id NOT IN (SELECT id FROM profiles) 
     OR actor_id NOT IN (SELECT id FROM profiles);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Clean up messages for deleted users
  DELETE FROM messages 
  WHERE sender_id NOT IN (SELECT id FROM profiles);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Clean up conversations for deleted users
  DELETE FROM conversations 
  WHERE participant1_id NOT IN (SELECT id FROM profiles) 
     OR participant2_id NOT IN (SELECT id FROM profiles);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Clean up comments for deleted users
  DELETE FROM comments 
  WHERE user_id NOT IN (SELECT id FROM profiles);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Clean up likes for deleted users
  DELETE FROM likes 
  WHERE user_id NOT IN (SELECT id FROM profiles);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Clean up follows for deleted users
  DELETE FROM follows 
  WHERE follower_id NOT IN (SELECT id FROM profiles) 
     OR following_id NOT IN (SELECT id FROM profiles);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Clean up posts for deleted users
  DELETE FROM posts 
  WHERE user_id NOT IN (SELECT id FROM profiles);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  RETURN 'Cleaned up ' || total_deleted || ' orphaned records';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_orphaned_data() TO authenticated;
