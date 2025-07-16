"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Bell, Heart, MessageCircle, UserPlus, Hand } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface Notification {
  id: string
  type: string
  read: boolean
  created_at: string
  actor: {
    username: string
    full_name: string | null
    avatar_url: string | null
  }
  post?: {
    id: string
    content: string
  }
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchNotifications()
      subscribeToNotifications()
    }
  }, [user])

  const fetchNotifications = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(username, full_name, avatar_url),
          post:posts(id, content)
        `)
        .eq("user_id", user.id)
        .neq("type", "message") // Exclude message notifications
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error

      setNotifications(data || [])
      setUnreadCount(data?.filter((n) => !n.read).length || 0)
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToNotifications = () => {
    if (!user) return

    const subscription = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Only update if it's not a message notification
          if (payload.new.type !== "message") {
            fetchNotifications()
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", notificationId)

      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .neq("type", "message") // Only mark non-message notifications as read

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="h-4 w-4 text-red-500" />
      case "comment":
        return <MessageCircle className="h-4 w-4 text-blue-500" />
      case "follow":
        return <UserPlus className="h-4 w-4 text-green-500" />
      case "poke":
        return <Hand className="h-4 w-4 text-orange-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getNotificationText = (notification: Notification) => {
    const actorName = notification.actor.full_name || notification.actor.username
    switch (notification.type) {
      case "like":
        return `${actorName} liked your post`
      case "comment":
        return `${actorName} commented on your post`
      case "follow":
        return `${actorName} started following you`
      case "poke":
        return `${actorName} poked you`
      default:
        return "New notification"
    }
  }

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case "like":
      case "comment":
        return notification.post ? `/post/${notification.post.id}` : "#"
      case "follow":
      case "poke":
        return `/profile/${notification.actor.username}`
      default:
        return "#"
    }
  }

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm">You'll see likes, comments, follows, and pokes here</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} className="p-0" asChild>
                <Link
                  href={getNotificationLink(notification)}
                  className={`flex items-start space-x-3 p-3 hover:bg-muted ${!notification.read ? "bg-muted/50" : ""}`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={notification.actor.avatar_url || ""} alt={notification.actor.username} />
                    <AvatarFallback>{notification.actor.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {getNotificationIcon(notification.type)}
                      <p className="text-sm font-medium truncate">{getNotificationText(notification)}</p>
                    </div>
                    {notification.post && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">"{notification.post.content}"</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
