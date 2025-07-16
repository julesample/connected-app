"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ExternalLink, Globe, MoreHorizontal, UserX, Hand, MessageCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { FollowersFollowingDialog } from "@/components/profile/followers-following-dialog"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

interface UserCardProps {
  profile: {
    id: string
    username: string
    full_name: string | null
    bio: string | null
    avatar_url: string | null
    website: string | null
    followers_count: number
    following_count: number
    posts_count: number
  }
  onProfileUpdate?: () => void
}

export function UserCard({ profile, onProfileUpdate }: UserCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [pokeStatus, setPokeStatus] = useState({ has_poked: false, poke_count: 0 })
  const [loading, setLoading] = useState(false)
  const [followersCount, setFollowersCount] = useState(profile.followers_count)
  const [followersDialog, setFollowersDialog] = useState(false)
  const [followingDialog, setFollowingDialog] = useState(false)
  const [blockDialog, setBlockDialog] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const isCurrentUser = user?.id === profile.id

  useEffect(() => {
    if (user && !isCurrentUser) {
      checkRelationshipStatus()
    }
  }, [user, profile.id, isCurrentUser])

  const checkRelationshipStatus = async () => {
    if (!user) return

    try {
      // Check if following
      const { data: followData } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profile.id)
        .single()

      setIsFollowing(!!followData)

      // Check if blocked
      const { data: blockData } = await supabase
        .from("blocks")
        .select("id")
        .or(
          `and(blocker_id.eq.${user.id},blocked_id.eq.${profile.id}),and(blocker_id.eq.${profile.id},blocked_id.eq.${user.id})`,
        )
        .single()

      setIsBlocked(!!blockData)

      // Get poke status
      const { data: pokeData } = await supabase.rpc("get_poke_status", {
        user_id: user.id,
        target_user_id: profile.id,
      })

      if (pokeData?.[0]) {
        setPokeStatus(pokeData[0])
      }
    } catch (error) {
      console.error("Error checking relationship status:", error)
    }
  }

  const handleFollow = async () => {
    if (!user || loading || isBlocked) return

    setLoading(true)

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)

        if (!error) {
          setIsFollowing(false)
          setFollowersCount((prev) => prev - 1)

          // Log activity
          await supabase.rpc("log_user_activity", {
            activity_type: "unfollow",
            target_user_id: profile.id,
            details: { username: profile.username },
          })

          toast({
            title: "Unfollowed",
            description: `You unfollowed @${profile.username}`,
          })
        }
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: profile.id,
        })

        if (!error) {
          setIsFollowing(true)
          setFollowersCount((prev) => prev + 1)

          // Log activity
          await supabase.rpc("log_user_activity", {
            activity_type: "follow",
            target_user_id: profile.id,
            details: { username: profile.username },
          })

          toast({
            title: "Following",
            description: `You are now following @${profile.username}`,
          })
        }
      }
    } catch (error) {
      console.error("Error updating follow status:", error)
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePoke = async () => {
    if (!user || loading || isBlocked) return

    setLoading(true)

    try {
      if (pokeStatus.has_poked) {
        const { error } = await supabase.from("pokes").delete().eq("poker_id", user.id).eq("poked_id", profile.id)

        if (!error) {
          setPokeStatus({ has_poked: false, poke_count: pokeStatus.poke_count - 1 })

          // Log activity
          await supabase.rpc("log_user_activity", {
            activity_type: "unpoke",
            target_user_id: profile.id,
            details: { username: profile.username },
          })

          toast({
            title: "Poke Removed",
            description: `You removed your poke from @${profile.username}`,
          })
        }
      } else {
        const { error } = await supabase.from("pokes").insert({
          poker_id: user.id,
          poked_id: profile.id,
        })

        if (!error) {
          setPokeStatus({ has_poked: true, poke_count: pokeStatus.poke_count + 1 })

          // Log activity
          await supabase.rpc("log_user_activity", {
            activity_type: "poke",
            target_user_id: profile.id,
            details: { username: profile.username },
          })

          toast({
            title: "Poked!",
            description: `You poked @${profile.username}`,
          })
        }
      }
    } catch (error) {
      console.error("Error updating poke status:", error)
      toast({
        title: "Error",
        description: "Failed to update poke status",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async () => {
    if (!user || blocking) return

    setBlocking(true)

    try {
      const { error } = await supabase.from("blocks").insert({
        blocker_id: user.id,
        blocked_id: profile.id,
      })

      if (!error) {
        setIsBlocked(true)
        setIsFollowing(false) // Unfollow when blocking

        // Log activity
        await supabase.rpc("log_user_activity", {
          activity_type: "block",
          target_user_id: profile.id,
          details: {
            username: profile.username,
            reason: "Blocked from profile",
          },
        })

        toast({
          title: "User Blocked",
          description: `You have blocked @${profile.username}`,
        })
        onProfileUpdate?.()
      }
    } catch (error) {
      console.error("Error blocking user:", error)
      toast({
        title: "Error",
        description: "Failed to block user",
        variant: "destructive",
      })
    } finally {
      setBlocking(false)
      setBlockDialog(false)
    }
  }

  const startConversation = async () => {
    if (!user || isBlocked) return

    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant1_id.eq.${user.id},participant2_id.eq.${profile.id}),and(participant1_id.eq.${profile.id},participant2_id.eq.${user.id})`,
        )
        .single()

      if (existingConv) {
        window.location.href = "/chat"
        return
      }

      // Create new conversation
      const { error } = await supabase.from("conversations").insert({
        participant1_id: user.id,
        participant2_id: profile.id,
      })

      if (!error) {
        window.location.href = "/chat"
      }
    } catch (error) {
      console.error("Error starting conversation:", error)
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      })
    }
  }

  const formatWebsiteUrl = (url: string) => {
    if (!url) return ""
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`
    }
    return url
  }

  const getDisplayUrl = (url: string) => {
    if (!url) return ""
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
  }

  if (isBlocked && !isCurrentUser) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">This user is blocked</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start space-x-3 md:space-x-4">
            <Link href={`/profile/${profile.username}`} className="flex-shrink-0">
              <Avatar className="h-16 w-16 md:h-20 md:w-20">
                <AvatarImage src={profile.avatar_url || ""} alt={profile.username} />
                <AvatarFallback className="text-lg md:text-xl">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${profile.username}`} className="block">
                    <h3 className="font-semibold text-lg md:text-xl truncate">
                      {profile.full_name || profile.username}
                    </h3>
                    <p className="text-muted-foreground text-sm md:text-base truncate">@{profile.username}</p>
                  </Link>

                  {pokeStatus.poke_count > 0 && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Hand className="h-3 w-3 mr-1" />
                        {pokeStatus.poke_count} poke{pokeStatus.poke_count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  )}
                </div>

                {user && !isCurrentUser && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={startConversation}>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Message
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBlockDialog(true)} className="text-destructive">
                        <UserX className="h-4 w-4 mr-2" />
                        Block User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {profile.bio && (
                <p className="text-sm md:text-base mt-2 line-clamp-3 break-words leading-relaxed">{profile.bio}</p>
              )}

              {profile.website && (
                <div className="mt-2">
                  <a
                    href={formatWebsiteUrl(profile.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-sm text-blue-500 hover:text-blue-600 hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    <span>{getDisplayUrl(profile.website)}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div className="flex items-center space-x-4 mt-3 text-sm md:text-base text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-foreground">{profile.posts_count}</span>
                  <span>posts</span>
                </div>
                <button
                  onClick={() => setFollowersDialog(true)}
                  className="flex items-center space-x-1 hover:underline"
                >
                  <span className="font-semibold text-foreground">{followersCount}</span>
                  <span>followers</span>
                </button>
                <button
                  onClick={() => setFollowingDialog(true)}
                  className="flex items-center space-x-1 hover:underline"
                >
                  <span className="font-semibold text-foreground">{profile.following_count}</span>
                  <span>following</span>
                </button>
              </div>

              {user && !isCurrentUser && (
                <div className="flex items-center space-x-2 mt-4">
                  <Button
                    onClick={handleFollow}
                    disabled={loading}
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className="text-sm px-6"
                  >
                    {isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                  <Button
                    onClick={handlePoke}
                    disabled={loading}
                    variant={pokeStatus.has_poked ? "secondary" : "outline"}
                    size="sm"
                    className="text-sm px-4"
                  >
                    <Hand className="h-4 w-4 mr-1" />
                    {pokeStatus.has_poked ? "Poked" : "Poke"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Followers Dialog */}
      <FollowersFollowingDialog
        open={followersDialog}
        onOpenChange={setFollowersDialog}
        userId={profile.id}
        username={profile.username}
        initialTab="followers"
      />

      {/* Following Dialog */}
      <FollowersFollowingDialog
        open={followingDialog}
        onOpenChange={setFollowingDialog}
        userId={profile.id}
        username={profile.username}
        initialTab="following"
      />

      {/* Block Confirmation Dialog */}
      <ConfirmationDialog
        open={blockDialog}
        onOpenChange={setBlockDialog}
        title="Block User"
        description={`Are you sure you want to block @${profile.username}? They won't be able to see your posts or contact you, and you won't see their content.`}
        confirmText="Block User"
        cancelText="Cancel"
        onConfirm={handleBlock}
        loading={blocking}
        variant="destructive"
      />
    </>
  )
}
