-- Update posts RLS policies to respect privacy settings
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;

-- Create new privacy-aware policies for posts
CREATE POLICY "Public posts are viewable by everyone" ON posts
  FOR SELECT USING (privacy = 'public');

CREATE POLICY "Users can view their own posts" ON posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Followers can view followers-only posts" ON posts
  FOR SELECT USING (
    privacy = 'followers' AND (
      auth.uid() = user_id OR
      EXISTS (
        SELECT 1 FROM follows 
        WHERE follower_id = auth.uid() 
        AND following_id = user_id
      )
    )
  );

-- Private posts are only viewable by the owner (covered by "Users can view their own posts")

-- Update comments policies to respect post privacy
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;

CREATE POLICY "Comments are viewable based on post privacy" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = comments.post_id 
      AND (
        -- Public posts
        posts.privacy = 'public' OR
        -- User's own posts
        posts.user_id = auth.uid() OR
        -- Followers-only posts where user follows the post owner
        (posts.privacy = 'followers' AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = auth.uid() 
          AND following_id = posts.user_id
        ))
      )
    )
  );

-- Update likes policies to respect post privacy
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;

CREATE POLICY "Likes are viewable based on post privacy" ON likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = likes.post_id 
      AND (
        -- Public posts
        posts.privacy = 'public' OR
        -- User's own posts
        posts.user_id = auth.uid() OR
        -- Followers-only posts where user follows the post owner
        (posts.privacy = 'followers' AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = auth.uid() 
          AND following_id = posts.user_id
        ))
      )
    )
  );

-- Users can only like posts they can see
CREATE POLICY "Users can like posts they can view" ON likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = likes.post_id 
      AND (
        -- Public posts
        posts.privacy = 'public' OR
        -- User's own posts
        posts.user_id = auth.uid() OR
        -- Followers-only posts where user follows the post owner
        (posts.privacy = 'followers' AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = auth.uid() 
          AND following_id = posts.user_id
        ))
      )
    )
  );

-- Users can only comment on posts they can see
CREATE POLICY "Users can comment on posts they can view" ON comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = comments.post_id 
      AND (
        -- Public posts
        posts.privacy = 'public' OR
        -- User's own posts
        posts.user_id = auth.uid() OR
        -- Followers-only posts where user follows the post owner
        (posts.privacy = 'followers' AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = auth.uid() 
          AND following_id = posts.user_id
        ))
      )
    )
  );
