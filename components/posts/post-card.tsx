"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Heart, MessageCircle, MoreHorizontal, Send, Lock, Users, Globe, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { moderateContent } from "@/lib/content-moderation"
import Image from "next/image"

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface PostCardProps {
  post: {
    id: string
    content: string
    image_url: string | null
    likes_count: number
    comments_count: number
    created_at: string
    privacy?: string
    user_id: string
    profiles: {
      id: string
      username: string
      full_name: string | null
      avatar_url: string | null
      is_private?: boolean
    } | null
  }
  onDelete?: () => void
}

export const PostCard: React.FC<PostCardProps> = ({ post, onDelete }) => {
  const { user } = useAuth()
  const toast = useToast()

  const [showComments, setShowComments] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [commentsCount, setCommentsCount] = useState(post.comments_count)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [deletingComment, setDeletingComment] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)
  const [deletePostDialog, setDeletePostDialog] = useState(false)
  const [deleteCommentDialog, setDeleteCommentDialog] = useState<{ open: boolean; commentId: string; commentUserId: string }>({
    open: false,
    commentId: "",
    commentUserId: "",
  })

  useEffect(() => {
    if (showComments) {
      setupCommentsRealtime()
    }
  }, [showComments, post.id])

  useEffect(() => {
    checkIfLiked()
  }, [user, post.id])

  const setupCommentsRealtime = () => {
    const channel = supabase
      .channel(`comments:${post.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${post.id}`,
        },
        () => {
          fetchComments()
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  const checkIfLiked = async () => {
    if (!user) return

    const { data } = await supabase.from("likes").select("id").eq("user_id", user.id).eq("post_id", post.id).single()

    setIsLiked(!!data)
  }

  const handleLike = async () => {
    if (!user || loading) return

    setLoading(true)

    if (isLiked) {
      // Unlike
      const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id)

      if (!error) {
        setIsLiked(false)
        setLikesCount((prev) => prev - 1)
      }
    } else {
      // Like
      const { error } = await supabase.from("likes").insert({
        user_id: user.id,
        post_id: post.id,
      })

      if (!error) {
        setIsLiked(true)
        setLikesCount((prev) => prev + 1)
      } else {
        toast.toast({
          title: "Error",
          description: "You don't have permission to like this post",
          variant: "destructive",
        })
      }
    }

    setLoading(false)
  }

  const fetchComments = async () => {
    if (commentsLoading) return

    setCommentsLoading(true)
    const { data, error } = await supabase
      .from("comments")
      .select(`
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching comments:", error)
      if (error.code === "42501") {
        toast.toast({
          title: "Access Denied",
          description: "You don't have permission to view comments on this post",
          variant: "destructive",
        })
      }
    } else {
      setComments(data || [])
      setCommentsCount(data?.length || 0)
    }
    setCommentsLoading(false)
  }

  const handleCommentToggle = () => {
    setShowComments(!showComments)
    if (!showComments && comments.length === 0) {
      fetchComments()
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim() || commentSubmitting) return

    // Check content moderation
    const moderation = moderateContent(newComment)
    if (!moderation.isClean) {
      toast.toast({
        title: "Comment Blocked",
        description: moderation.reason || "Your comment contains inappropriate language",
        variant: "destructive",
      })
      return
    }

    setCommentSubmitting(true)

    const { error } = await supabase.from("comments").insert({
      user_id: user.id,
      post_id: post.id,
      content: newComment.trim(),
    })

    if (error) {
      toast.toast({
        title: "Error",
        description:
          error.code === "42501" ? "You don't have permission to comment on this post" : "Failed to add comment",
        variant: "destructive",
      })
    } else {
      setNewComment("")
      toast.toast({
        title: "Success",
        description: "Comment added successfully!",
      })
    }

    setCommentSubmitting(false)
  }

  const confirmDeleteComment = async () => {
    if (!user || deletingComment) return

    setDeletingComment(true)

    const { error } = await supabase.from("comments").delete().eq("id", deleteCommentDialog.commentId)

    if (error) {
      toast.toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      })
    } else {
      toast.toast({
        title: "Success",
        description: "Comment deleted successfully",
      })
      setDeleteCommentDialog({ open: false, commentId: "", commentUserId: "" })
    }

    setDeletingComment(false)
  }

  const confirmDeletePost = async () => {
    if (!user || user.id !== post.profiles?.id || deletingPost) return

    setDeletingPost(true)

    const { error } = await supabase.from("posts").delete().eq("id", post.id)

    if (error) {
      toast.toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      })
    } else {
      toast.toast({
        title: "Success",
        description: "Post deleted successfully",
      })
      setDeletePostDialog(false)
      onDelete?.()
    }

    setDeletingPost(false)
  }

  const getPrivacyIcon = () => {
    // Override individual post privacy if profile is private
    if (post.profiles?.is_private) {
      return <Lock className="h-3 w-3 text-red-500" />
    }
    switch (post.privacy) {
      case "private":
        return <Lock className="h-3 w-3 text-red-500" />
      case "followers":
        return <Users className="h-3 w-3 text-yellow-500" />
      default:
        return <Globe className="h-3 w-3 text-green-500" />
    }
  }

  const getPrivacyText = () => {
    // Override individual post privacy if profile is private
    if (post.profiles?.is_private) {
      return "Private"
    }
    switch (post.privacy) {
      case "private":
        return "Private"
      case "followers":
        return "Followers only"
      default:
        return "Public"
    }
  }

  return (
    <>
      <Card className="w-full mx-auto border-0 border-b rounded-none md:border md:rounded-lg md:max-w-2xl">
        <CardHeader className="flex flex-row items-center space-y-0 pb-3 px-4 md:px-6">
          <Link href={`/profile/${post.profiles?.username}`} className="flex items-center space-x-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={post.profiles?.avatar_url || ""} alt={post.profiles?.username || ""} />
              <AvatarFallback>{post.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate text-sm md:text-base">
                {post.profiles?.full_name || post.profiles?.username}
              </p>
              <div className="flex items-center space-x-2">
                <p className="text-xs md:text-sm text-muted-foreground truncate">@{post.profiles?.username}</p>
                <div className="flex items-center space-x-1" title={getPrivacyText()}>
                  {getPrivacyIcon()}
                </div>
              </div>
            </div>
          </Link>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
            <span className="text-xs text-muted-foreground sm:hidden">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true }).replace("about ", "")}
            </span>
            {user?.id === post.profiles?.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDeletePostDialog(true)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-3 px-4 md:px-6">
          <p className="text-sm md:text-base mb-3 whitespace-pre-wrap break-words">{post.content}</p>
          {post.image_url && (
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
              <Image
                src={post.image_url || "/placeholder.svg"}
                alt="Post image"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority={false}
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col pt-2 px-4 md:px-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-1 md:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={loading}
                className={"h-8 px-2 md:px-3 " + (isLiked ? "text-red-500 hover:text-red-600" : "")}
              >
                <Heart className={"h-4 w-4 mr-1 " + (isLiked ? "fill-current" : "")} />
                <span className="text-xs md:text-sm">{likesCount}</span>
              </Button>

              <Button variant="ghost" size="sm" onClick={handleCommentToggle} className="h-8 px-2 md:px-3">
                <MessageCircle className="h-4 w-4 mr-1" />
                <span className="text-xs md:text-sm">{commentsCount}</span>
              </Button>
            </div>
          </div>

          <Collapsible open={showComments} onOpenChange={setShowComments} className="w-full">
            <CollapsibleContent className="space-y-4 mt-4">
              {user && (
                <form onSubmit={handleCommentSubmit} className="flex space-x-2">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={user.user_metadata?.avatar_url || ""} alt="You" />
                    <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex space-x-2">
                    <Textarea
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[60px] resize-none text-sm"
                      disabled={commentSubmitting}
                    />
                    <Button type="submit" size="sm" disabled={!newComment.trim() || commentSubmitting}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {commentsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading comments...</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-2 group">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={comment.profiles.avatar_url || ""} alt={comment.profiles.username} />
                        <AvatarFallback>{comment.profiles.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm">
                              {comment.profiles.full_name || comment.profiles.username}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {user && (user.id === comment.user_id || user.id === post.user_id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteCommentDialog({
                                  open: true,
                                  commentId: comment.id,
                                  commentUserId: comment.user_id,
                                })
                              }
                              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardFooter>
      </Card>

      {/* Delete Post Confirmation Dialog */}
      <ConfirmationDialog
        open={deletePostDialog}
        onOpenChange={setDeletePostDialog}
        title="Delete Post"
        description="Are you sure you want to delete this post? This action cannot be undone and will also delete all comments and likes."
        confirmText="Delete Post"
        cancelText="Cancel"
        onConfirm={confirmDeletePost}
        loading={deletingPost}
        variant="destructive"
      />

      {/* Delete Comment Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteCommentDialog.open}
        onOpenChange={(open) => setDeleteCommentDialog({ ...deleteCommentDialog, open })}
        title="Delete Comment"
        description="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete Comment"
        cancelText="Cancel"
        onConfirm={confirmDeleteComment}
        loading={deletingComment}
        variant="destructive"
      />
    </>
  )
}
