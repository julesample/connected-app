"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Activity, Heart, MessageCircle, UserPlus, UserX, Hand } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface UserActivity {
  id: string
  target_user_id: string | null
  activity_type: string
  details: any
  created_at: string
  target_user?: {
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

export function ActivityLogSection() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [activities, setActivities] = useState<UserActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchActivities()
      setupRealtimeSubscription()
    }
  }, [user])

  const setupRealtimeSubscription = () => {
    if (!user) return

    const subscription = supabase
      .channel("user_activities_updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_activities",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchActivities()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const fetchActivities = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("user_activities")
        .select(`
          *,
          target_user:profiles!user_activities_target_user_id_fkey(
            username,
            full_name,
            avatar_url
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error

      setActivities(data || [])
    } catch (error) {
      console.error("Error fetching activities:", error)
      toast({
        title: "Error",
        description: "Failed to load activity log",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "follow":
        return <UserPlus className="h-4 w-4 text-green-500" />
      case "unfollow":
        return <UserPlus className="h-4 w-4 text-gray-500" />
      case "block":
        return <UserX className="h-4 w-4 text-red-500" />
      case "unblock":
        return <UserX className="h-4 w-4 text-green-500" />
      case "poke":
        return <Hand className="h-4 w-4 text-orange-500" />
      case "unpoke":
        return <Hand className="h-4 w-4 text-gray-500" />
      case "like":
        return <Heart className="h-4 w-4 text-red-500" />
      case "unlike":
        return <Heart className="h-4 w-4 text-gray-500" />
      case "comment":
        return <MessageCircle className="h-4 w-4 text-blue-500" />
      case "message":
        return <MessageCircle className="h-4 w-4 text-purple-500" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActivityText = (activity: UserActivity) => {
    const targetName = activity.target_user?.full_name || activity.target_user?.username || "Unknown User"

    switch (activity.activity_type) {
      case "follow":
        return `Followed ${targetName}`
      case "unfollow":
        return `Unfollowed ${targetName}`
      case "block":
        return `Blocked ${targetName}`
      case "unblock":
        return `Unblocked ${targetName}`
      case "poke":
        return `Poked ${targetName}`
      case "unpoke":
        return `Removed poke from ${targetName}`
      case "like":
        return `Liked a post`
      case "unlike":
        return `Unliked a post`
      case "comment":
        return `Commented on a post`
      case "message":
        return `Sent a message to ${targetName}`
      default:
        return `Unknown activity`
    }
  }

  const getActivityVariant = (type: string) => {
    switch (type) {
      case "follow":
      case "unblock":
        return "default"
      case "block":
        return "destructive"
      case "unfollow":
      case "unpoke":
      case "unlike":
        return "secondary"
      case "poke":
        return "outline"
      default:
        return "secondary"
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Activity Log
          </CardTitle>
          <CardDescription>Your recent activity and interactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Your recent activity and interactions. This helps you track your social media usage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No activity yet</p>
            <p className="text-sm">Your interactions will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex-shrink-0">{getActivityIcon(activity.activity_type)}</div>

                  {activity.target_user && (
                    <Link href={`/profile/${activity.target_user.username}`} className="flex-shrink-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={activity.target_user.avatar_url || ""} alt={activity.target_user.username} />
                        <AvatarFallback>{activity.target_user.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Link>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium truncate">{getActivityText(activity)}</p>
                      <Badge variant={getActivityVariant(activity.activity_type)} className="text-xs">
                        {activity.activity_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                    {activity.details && Object.keys(activity.details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.details.reason && `Reason: ${activity.details.reason}`}
                        {activity.details.action && `Action: ${activity.details.action}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
