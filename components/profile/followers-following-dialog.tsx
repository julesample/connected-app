"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface User {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  followers_count: number
  following_count: number
}

interface FollowersFollowingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  username: string
  initialTab?: "followers" | "following"
}

export function FollowersFollowingDialog({
  open,
  onOpenChange,
  userId,
  username,
  initialTab = "followers",
}: FollowersFollowingDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [followers, setFollowers] = useState<User[]>([])
  const [following, setFollowing] = useState<User[]>([])
  const [loadingFollowers, setLoadingFollowers] = useState(false)
  const [loadingFollowing, setLoadingFollowing] = useState(false)
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set())
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      fetchFollowers()
      fetchFollowing()
      if (user) {
        fetchUserFollowing()
      }
    }
  }, [open, userId, user])

  const fetchFollowers = async () => {
    setLoadingFollowers(true)
    try {
      const { data, error } = await supabase
        .from("follows")
        .select(`
          follower_id,
          profiles!follows_follower_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            followers_count,
            following_count
          )
        `)
        .eq("following_id", userId)

      if (error) throw error

      const followersData = data?.map((item) => item.profiles).filter(Boolean) || []
      setFollowers(followersData as User[])
    } catch (error) {
      console.error("Error fetching followers:", error)
    } finally {
      setLoadingFollowers(false)
    }
  }

  const fetchFollowing = async () => {
    setLoadingFollowing(true)
    try {
      const { data, error } = await supabase
        .from("follows")
        .select(`
          following_id,
          profiles!follows_following_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            followers_count,
            following_count
          )
        `)
        .eq("follower_id", userId)

      if (error) throw error

      const followingData = data?.map((item) => item.profiles).filter(Boolean) || []
      setFollowing(followingData as User[])
    } catch (error) {
      console.error("Error fetching following:", error)
    } finally {
      setLoadingFollowing(false)
    }
  }

  const fetchUserFollowing = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", user.id)

      if (error) throw error

      const followingIds = new Set(data?.map((item) => item.following_id) || [])
      setFollowingUsers(followingIds)
    } catch (error) {
      console.error("Error fetching user following:", error)
    }
  }

  const handleFollow = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!user || followLoading.has(targetUserId)) return

    setFollowLoading((prev) => new Set([...prev, targetUserId]))

    try {
      if (isCurrentlyFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)

        if (!error) {
          setFollowingUsers((prev) => {
            const newSet = new Set(prev)
            newSet.delete(targetUserId)
            return newSet
          })
          toast({
            title: "Unfollowed",
            description: "You unfollowed this user",
          })
        }
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
        })

        if (!error) {
          setFollowingUsers((prev) => new Set([...prev, targetUserId]))
          toast({
            title: "Following",
            description: "You are now following this user",
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
      setFollowLoading((prev) => {
        const newSet = new Set(prev)
        newSet.delete(targetUserId)
        return newSet
      })
    }
  }

  const UserList = ({ users, loading }: { users: User[]; loading: boolean }) => {
    if (loading) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )
    }

    if (users.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No users found</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {users.map((profile) => {
          const isFollowing = followingUsers.has(profile.id)
          const isLoadingFollow = followLoading.has(profile.id)
          const isCurrentUser = user?.id === profile.id

          return (
            <div key={profile.id} className="flex items-center justify-between p-3 hover:bg-muted rounded-lg">
              <Link href={`/profile/${profile.username}`} className="flex items-center space-x-3 flex-1 min-w-0">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={profile.avatar_url || ""} alt={profile.username} />
                  <AvatarFallback>{profile.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{profile.full_name || profile.username}</p>
                  <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span>{profile.followers_count} followers</span>
                    <span>{profile.following_count} following</span>
                  </div>
                </div>
              </Link>
              {user && !isCurrentUser && (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleFollow(profile.id, isFollowing)}
                  disabled={isLoadingFollow}
                >
                  {isLoadingFollow && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isFollowing ? "Unfollow" : "Follow"}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>@{username}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={initialTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="followers">Followers</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>
          <TabsContent value="followers" className="flex-1">
            <ScrollArea className="h-full">
              <UserList users={followers} loading={loadingFollowers} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="following" className="flex-1">
            <ScrollArea className="h-full">
              <UserList users={following} loading={loadingFollowing} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
