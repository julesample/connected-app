"use client"

import { useEffect, useState } from "react"
import { PostCard } from "./post-card"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"

// Define the Post interface with necessary fields for privacy checks
interface Post {
  id: string
  user_id: string // Added user_id
  content: string
  image_url: string | null
  likes_count: number
  comments_count: number
  created_at: string
  allowed_users: string[] | null // Added for private posts
  profiles: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
    is_private: boolean // Added for profile privacy
  }
}

interface PostFeedProps {
  feedType?: "home" | "explore" | "profile"
  userId?: string
}

export function PostFeed({ feedType = "home", userId }: PostFeedProps) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPosts()
  }, [feedType, userId, user]) // Depend on user to re-fetch when auth state changes

  const fetchPosts = async () => {
    setLoading(true)

    // Fetch followed user IDs for home feed and privacy checks
    const { data: followsData, error: followsError } = await supabase.from("follows").select("following_id").eq("follower_id", user?.id ?? "")
    const followingIds = followsData?.map((f) => f.following_id) || []

    let query = supabase
      .from("posts")
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, created_at,
        allowed_users,
        profiles (
          id,
          username,
          full_name,
          avatar_url,
          is_private
        )
      `)
      .order("created_at", { ascending: false })

    if (feedType === "home" && user) {
      const allIds = [...followingIds, user.id]
      if (allIds.length > 0) {
        query = query.in("user_id", allIds)
      } else {
        // If not following anyone, just show own posts
        query = query.eq("user_id", user.id)
      }
    } else if (feedType === "profile" && userId) {
      query = query.eq("user_id", userId)
    } else if (feedType === "explore") {
      // For explore, only show posts from non-private profiles
      // This is a server-side filter to reduce data transfer
      query = query.eq("profiles.is_private", false)
    }

    const { data, error } = await query as { data: Post[] | null, error: any }

    if (error) {
      console.error("Error fetching posts:", error)
      setPosts([]) // Clear posts on error
      setLoading(false) // Ensure loading is set to false
      return // Exit early if there's an error
    }

    // Filter posts based on privacy and user relationship
    const filteredPosts = data?.filter((post: Post) => {
      // Exclude posts with missing profile data
      if (!post.profiles) {
        return false
      }

      const isAuthorPrivate = post.profiles.is_private ?? false
      const isOwner = post.user_id === user?.id
      const isFollower = followingIds.includes(post.user_id)
      const isAllowedUser = post.allowed_users?.includes(user?.id ?? "") ?? false

      if (isOwner) {
        return true // User can always see their own posts
      }

      if (!isAuthorPrivate) {
        return true // Posts from public profiles are visible to everyone
      }

      // If author is private, override individual post privacy and only allow followers or allowed users
      return isFollower || isAllowedUser
    })

    setPosts(filteredPosts || [])
    setLoading(false)
  }

  const handlePostDelete = () => {
    fetchPosts() // Refresh the feed
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {feedType === "home"
          ? "No posts in your feed. Try following some users!"
          : feedType === "explore"
            ? "No public posts found."
            : "No posts found."}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDelete={handlePostDelete} />
      ))}
    </div>
  )
}
