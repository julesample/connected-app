-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  username_val TEXT;
  full_name_val TEXT;
BEGIN
  -- Extract username from metadata or email
  username_val := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'user_name', 
    split_part(NEW.email, '@', 1)
  );
  
  -- Extract full name from metadata
  full_name_val := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'fullName',
    NEW.raw_user_meta_data->>'name',
    ''
  );

  -- Insert into profiles table
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    username_val,
    full_name_val,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle duplicate username by appending random number
    INSERT INTO profiles (id, username, full_name, avatar_url)
    VALUES (
      NEW.id,
      username_val || '_' || floor(random() * 10000)::text,
      full_name_val,
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error and still return NEW to not block user creation
    RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    -- Try a basic insert as fallback
    BEGIN
      INSERT INTO profiles (id, username, full_name)
      VALUES (
        NEW.id,
        'user_' || NEW.id::text,
        'New User'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Fallback insert also failed for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update post counts
CREATE OR REPLACE FUNCTION update_post_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET posts_count = posts_count + 1 WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET posts_count = posts_count - 1 WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for post counts
DROP TRIGGER IF EXISTS posts_count_trigger ON posts;
CREATE TRIGGER posts_count_trigger
  AFTER INSERT OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_post_counts();

-- Function to update like counts
CREATE OR REPLACE FUNCTION update_like_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for like counts
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;
CREATE TRIGGER likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_like_counts();

-- Function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for comment counts
DROP TRIGGER IF EXISTS comments_count_trigger ON comments;
CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_counts();

-- Function to update follow counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for follow counts
DROP TRIGGER IF EXISTS follows_count_trigger ON follows;
CREATE TRIGGER follows_count_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
