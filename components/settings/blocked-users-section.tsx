"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Loader2, UserX, Calendar, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

interface BlockedUser {
  blocked_user_id: string
  blocked_username: string
  blocked_full_name: string | null
  blocked_avatar_url: string | null
  blocked_at: string
  block_reason: string
}

export function BlockedUsersSection() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [unblockDialog, setUnblockDialog] = useState<{
    open: boolean
    userId: string
    username: string
  }>({
    open: false,
    userId: "",
    username: "",
  })
  const [unblocking, setUnblocking] = useState(false)

  useEffect(() => {
    if (user) {
      fetchBlockedUsers()
      setupRealtimeSubscription()
    }
  }, [user])

  const setupRealtimeSubscription = () => {
    if (!user) return

    const subscription = supabase
      .channel("blocked_users_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocks",
          filter: `blocker_id=eq.${user.id}`,
        },
        () => {
          fetchBlockedUsers()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const fetchBlockedUsers = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_blocked_users_with_activity")

      if (error) throw error

      setBlockedUsers(data || [])
    } catch (error) {
      console.error("Error fetching blocked users:", error)
      toast({
        title: "Error",
        description: "Failed to load blocked users",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUnblock = async () => {
    if (!user || unblocking || !unblockDialog.userId) return

    setUnblocking(true)

    try {
      const { data, error } = await supabase.rpc("unblock_user", {
        target_user_id: unblockDialog.userId,
      })

      if (error) throw error

      if (data) {
        toast({
          title: "User Unblocked",
          description: `You have unblocked @${unblockDialog.username}`,
        })
        fetchBlockedUsers()
        setUnblockDialog({ open: false, userId: "", username: "" })
      }
    } catch (error: any) {
      console.error("Error unblocking user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to unblock user",
        variant: "destructive",
      })
    } finally {
      setUnblocking(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserX className="h-5 w-5 mr-2" />
            Blocked Users
          </CardTitle>
          <CardDescription>Manage users you have blocked</CardDescription>
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserX className="h-5 w-5 mr-2" />
            Blocked Users
          </CardTitle>
          <CardDescription>
            Manage users you have blocked. Blocked users cannot see your content or contact you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blockedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No blocked users</p>
              <p className="text-sm">Users you block will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {blockedUsers.map((blockedUser) => (
                  <div
                    key={blockedUser.blocked_user_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={blockedUser.blocked_avatar_url || ""} alt={blockedUser.blocked_username} />
                        <AvatarFallback>{blockedUser.blocked_username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold truncate">
                            {blockedUser.blocked_full_name || blockedUser.blocked_username}
                          </p>
                          <Badge variant="destructive" className="text-xs">
                            Blocked
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">@{blockedUser.blocked_username}</p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Blocked {formatDistanceToNow(new Date(blockedUser.blocked_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        {blockedUser.block_reason && blockedUser.block_reason !== "No reason provided" && (
                          <div className="flex items-center space-x-1 mt-1">
                            <AlertCircle className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{blockedUser.block_reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setUnblockDialog({
                            open: true,
                            userId: blockedUser.blocked_user_id,
                            username: blockedUser.blocked_username,
                          })
                        }
                      >
                        Unblock
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Unblock Confirmation Dialog */}
      <ConfirmationDialog
        open={unblockDialog.open}
        onOpenChange={(open) => setUnblockDialog({ ...unblockDialog, open })}
        title="Unblock User"
        description={`Are you sure you want to unblock @${unblockDialog.username}? They will be able to see your content and contact you again.`}
        confirmText="Unblock User"
        cancelText="Cancel"
        onConfirm={handleUnblock}
        loading={unblocking}
        variant="default"
      />
    </>
  )
}
