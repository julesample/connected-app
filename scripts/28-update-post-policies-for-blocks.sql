-- Update posts policies to respect blocks
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Users can view their own posts" ON posts;
DROP POLICY IF EXISTS "Followers can view followers-only posts" ON posts;

-- Create new policies that respect blocks
CREATE POLICY "Public posts are viewable by non-blocked users" ON posts
  FOR SELECT USING (
    privacy = 'public' AND
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = auth.uid() AND blocked_id = user_id)
         OR (blocker_id = user_id AND blocked_id = auth.uid())
    )
  );

CREATE POLICY "Users can view their own posts" ON posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Followers can view followers-only posts from non-blocked users" ON posts
  FOR SELECT USING (
    privacy = 'followers' AND (
      auth.uid() = user_id OR
      (EXISTS (
        SELECT 1 FROM follows 
        WHERE follower_id = auth.uid() 
        AND following_id = user_id
      ) AND NOT EXISTS (
        SELECT 1 FROM blocks 
        WHERE (blocker_id = auth.uid() AND blocked_id = user_id)
           OR (blocker_id = user_id AND blocked_id = auth.uid())
      ))
    )
  );

-- Update comments policies to respect blocks
DROP POLICY IF EXISTS "Comments are viewable based on post privacy" ON comments;

CREATE POLICY "Comments are viewable based on post privacy and blocks" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = comments.post_id 
      AND (
        -- Public posts from non-blocked users
        (posts.privacy = 'public' AND NOT EXISTS (
          SELECT 1 FROM blocks 
          WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id)
             OR (blocker_id = posts.user_id AND blocked_id = auth.uid())
        )) OR
        -- User's own posts
        posts.user_id = auth.uid() OR
        -- Followers-only posts where user follows the post owner and no blocks
        (posts.privacy = 'followers' AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = auth.uid() 
          AND following_id = posts.user_id
        ) AND NOT EXISTS (
          SELECT 1 FROM blocks 
          WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id)
             OR (blocker_id = posts.user_id AND blocked_id = auth.uid())
        ))
      )
    ) AND
    -- Also check if the comment author is blocked
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = auth.uid() AND blocked_id = comments.user_id)
         OR (blocker_id = comments.user_id AND blocked_id = auth.uid())
    )
  );

-- Update likes policies to respect blocks
DROP POLICY IF EXISTS "Likes are viewable based on post privacy" ON likes;

CREATE POLICY "Likes are viewable based on post privacy and blocks" ON likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = likes.post_id 
      AND (
        -- Public posts from non-blocked users
        (posts.privacy = 'public' AND NOT EXISTS (
          SELECT 1 FROM blocks 
          WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id)
             OR (blocker_id = posts.user_id AND blocked_id = auth.uid())
        )) OR
        -- User's own posts
        posts.user_id = auth.uid() OR
        -- Followers-only posts where user follows the post owner and no blocks
        (posts.privacy = 'followers' AND EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = auth.uid() 
          AND following_id = posts.user_id
        ) AND NOT EXISTS (
          SELECT 1 FROM blocks 
          WHERE (blocker_id = auth.uid() AND blocked_id = posts.user_id)
             OR (blocker_id = posts.user_id AND blocked_id = auth.uid())
        ))
      )
    ) AND
    -- Also check if the liker is blocked
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = auth.uid() AND blocked_id = likes.user_id)
         OR (blocker_id = likes.user_id AND blocked_id = auth.uid())
    )
  );

-- Update follows policies to respect blocks
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;

CREATE POLICY "Follows are viewable by non-blocked users" ON follows
  FOR SELECT USING (
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = auth.uid() AND blocked_id = follower_id)
         OR (blocker_id = follower_id AND blocked_id = auth.uid())
         OR (blocker_id = auth.uid() AND blocked_id = following_id)
         OR (blocker_id = following_id AND blocked_id = auth.uid())
    )
  );

-- Prevent following blocked users
DROP POLICY IF EXISTS "Users can insert their own follows" ON follows;

CREATE POLICY "Users can follow non-blocked users" ON follows
  FOR INSERT WITH CHECK (
    auth.uid() = follower_id AND
    NOT EXISTS (
      SELECT 1 FROM blocks 
      WHERE (blocker_id = auth.uid() AND blocked_id = following_id)
         OR (blocker_id = following_id AND blocked_id = auth.uid())
    )
  );
