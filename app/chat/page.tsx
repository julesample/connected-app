"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Navbar } from "@/components/layout/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, Search, Trash2, MoreHorizontal, AlertTriangle, Clock } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { TypingIndicator } from "@/components/chat/typing-indicator"
import { moderateContent } from "@/lib/content-moderation"

interface Conversation {
  id: string
  participant1_id: string
  participant2_id: string
  last_message_at: string
  deletion_requested_by: string | null
  deletion_requested_at: string | null
  other_user: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
  last_message?: {
    content: string
    sender_id: string
  }
  unread_count?: number
  deletion_request?: {
    id: string
    requested_by: string
    requested_at: string
    expires_at: string
  }
}

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  read_at: string | null
  sender: {
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

export default function ChatPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<any>(null)

  // Dialog states
  const [deleteMessageDialog, setDeleteMessageDialog] = useState<{
    open: boolean
    messageId: string
    senderId: string
  }>({
    open: false,
    messageId: "",
    senderId: "",
  })
  const [deleteConversationDialog, setDeleteConversationDialog] = useState(false)
  const [deletingMessage, setDeletingMessage] = useState(false)
  const [deletingConversation, setDeletingConversation] = useState(false)

  useEffect(() => {
    if (user) {
      fetchConversations()
      setupConversationsRealtime()
      setupDeletionRequestsRealtime()
    }
  }, [user])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation)
      setupRealtimeSubscription(selectedConversation)
      markMessagesAsRead(selectedConversation)
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [selectedConversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const setupConversationsRealtime = () => {
    const conversationsChannel = supabase
      .channel("conversations_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          fetchConversations()
        },
      )
      .subscribe()

    return () => {
      conversationsChannel.unsubscribe()
    }
  }

  const setupDeletionRequestsRealtime = () => {
    const deletionChannel = supabase
      .channel("deletion_requests_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_deletion_requests",
        },
        () => {
          fetchConversations()
        },
      )
      .subscribe()

    return () => {
      deletionChannel.unsubscribe()
    }
  }

  const setupRealtimeSubscription = (conversationId: string) => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }

    // Subscribe to new messages
    channelRef.current = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("Message change:", payload)
          fetchMessages(conversationId)
          fetchConversations() // Update conversation list with new message
        },
      )
      .subscribe()
  }

  const fetchConversations = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          participant1:profiles!conversations_participant1_id_fkey(*),
          participant2:profiles!conversations_participant2_id_fkey(*)
        `)
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false })

      if (error) throw error

      // Get unread message counts and deletion requests for each conversation
      const conversationsWithData = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUser = conv.participant1_id === user.id ? conv.participant2 : conv.participant1

          // Count unread messages
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .neq("sender_id", user.id)
            .is("read_at", null)

          // Get deletion request if any
          const { data: deletionRequest } = await supabase
            .from("conversation_deletion_requests")
            .select("*")
            .eq("conversation_id", conv.id)
            .gt("expires_at", new Date().toISOString())
            .single()

          return {
            ...conv,
            other_user: otherUser,
            unread_count: count || 0,
            deletion_request: deletionRequest,
          }
        }),
      )

      setConversations(conversationsWithData)
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    setMessagesLoading(true)
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles(username, full_name, avatar_url)
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })

      if (error) throw error

      setMessages(data || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const markMessagesAsRead = async (conversationId: string) => {
    if (!user) return

    try {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null)

      // Refresh conversations to update unread counts
      fetchConversations()
    } catch (error) {
      console.error("Error marking messages as read:", error)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq("id", user?.id)
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
    } catch (error) {
      console.error("Error searching users:", error)
    } finally {
      setSearching(false)
    }
  }

  const startConversation = async (otherUserId: string) => {
    if (!user) return

    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant1_id.eq.${user.id},participant2_id.eq.${otherUserId}),and(participant1_id.eq.${otherUserId},participant2_id.eq.${user.id})`,
        )
        .single()

      if (existingConv) {
        setSelectedConversation(existingConv.id)
        setSearchQuery("")
        setSearchResults([])
        return
      }

      // Create new conversation
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          participant1_id: user.id,
          participant2_id: otherUserId,
        })
        .select()
        .single()

      if (error) throw error

      setSelectedConversation(data.id)
      fetchConversations()
      setSearchQuery("")
      setSearchResults([])
    } catch (error) {
      console.error("Error starting conversation:", error)
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      })
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedConversation || !newMessage.trim() || sending) return

    // Check content moderation
    const moderation = moderateContent(newMessage)
    if (!moderation.isClean) {
      toast({
        title: "Message Blocked",
        description: moderation.reason || "Your message contains inappropriate language",
        variant: "destructive",
      })
      return
    }

    setSending(true)
    const messageContent = newMessage.trim()
    setNewMessage("") // Clear input immediately for better UX

    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: messageContent,
      })

      if (error) throw error

      // Send stop typing event
      sendStopTypingEvent()

      toast({
        title: "Success",
        description: "Message sent successfully!",
      })
    } catch (error) {
      console.error("Error sending message:", error)
      setNewMessage(messageContent) // Restore message on error
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const confirmDeleteMessage = async () => {
    if (!user || deletingMessage) return

    setDeletingMessage(true)

    const { error } = await supabase.from("messages").delete().eq("id", deleteMessageDialog.messageId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Message deleted successfully",
      })
      setDeleteMessageDialog({ open: false, messageId: "", senderId: "" })
    }

    setDeletingMessage(false)
  }

  const requestConversationDeletion = async () => {
    if (!user || !selectedConversation || deletingConversation) return

    setDeletingConversation(true)

    try {
      const { data, error } = await supabase.rpc("approve_conversation_deletion", {
        conv_id: selectedConversation,
      })

      if (error) throw error

      if (data) {
        // Conversation was deleted (both users agreed)
        toast({
          title: "Conversation Deleted",
          description: "The conversation has been permanently deleted",
        })
        setSelectedConversation(null)
      } else {
        // Deletion request was created/updated
        toast({
          title: "Deletion Request Sent",
          description: "The other participant will be notified to approve the deletion",
        })
      }

      fetchConversations()
      setDeleteConversationDialog(false)
    } catch (error: any) {
      console.error("Error requesting conversation deletion:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to request conversation deletion",
        variant: "destructive",
      })
    } finally {
      setDeletingConversation(false)
    }
  }

  const cancelDeletionRequest = async (conversationId: string) => {
    try {
      const { error } = await supabase.rpc("cancel_conversation_deletion", {
        conv_id: conversationId,
      })

      if (error) throw error

      toast({
        title: "Request Cancelled",
        description: "Deletion request has been cancelled",
      })

      fetchConversations()
    } catch (error: any) {
      console.error("Error cancelling deletion request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to cancel deletion request",
        variant: "destructive",
      })
    }
  }

  const approveDeletionRequest = async (conversationId: string) => {
    try {
      const { data, error } = await supabase.rpc("approve_conversation_deletion", {
        conv_id: conversationId,
      })

      if (error) throw error

      if (data) {
        toast({
          title: "Conversation Deleted",
          description: "The conversation has been permanently deleted",
        })
        if (selectedConversation === conversationId) {
          setSelectedConversation(null)
        }
      }

      fetchConversations()
    } catch (error: any) {
      console.error("Error approving deletion request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to approve deletion request",
        variant: "destructive",
      })
    }
  }

  const sendTypingEvent = () => {
    if (!user || !selectedConversation) return

    const channel = supabase.channel(`typing:${selectedConversation}`)
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id },
    })
  }

  const sendStopTypingEvent = () => {
    if (!user || !selectedConversation) return

    const channel = supabase.channel(`typing:${selectedConversation}`)
    channel.send({
      type: "broadcast",
      event: "stop_typing",
      payload: { user_id: user.id },
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)

    // Send typing event
    sendTypingEvent()

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTypingEvent()
    }, 2000)
  }

  const selectedConvData = conversations.find((c) => c.id === selectedConversation)
  const totalUnreadMessages = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0)

  return (
    <>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
            {/* Conversations List */}
            <Card className="md:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <span>Messages</span>
                    {totalUnreadMessages > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {totalUnreadMessages}
                      </Badge>
                    )}
                  </CardTitle>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      searchUsers(e.target.value)
                    }}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  {searchQuery && (
                    <div className="p-4 border-b">
                      <h4 className="font-semibold mb-2">Search Results</h4>
                      {searching ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="space-y-2">
                          {searchResults.map((profile) => (
                            <div
                              key={profile.id}
                              className="flex items-center space-x-3 p-2 hover:bg-muted rounded-lg cursor-pointer"
                              onClick={() => startConversation(profile.id)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={profile.avatar_url || ""} alt={profile.username} />
                                <AvatarFallback>{profile.username.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-sm">{profile.full_name || profile.username}</p>
                                <p className="text-xs text-muted-foreground">@{profile.username}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No users found</p>
                      )}
                    </div>
                  )}

                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : conversations.length > 0 ? (
                    <div className="space-y-1">
                      {conversations.map((conversation) => (
                        <div key={conversation.id} className="relative">
                          <div
                            className={`flex items-center space-x-3 p-4 hover:bg-muted cursor-pointer relative ${
                              selectedConversation === conversation.id ? "bg-muted" : ""
                            }`}
                            onClick={() => {
                              setSelectedConversation(conversation.id)
                            }}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={conversation.other_user.avatar_url || ""}
                                alt={conversation.other_user.username}
                              />
                              <AvatarFallback>
                                {conversation.other_user.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">
                                {conversation.other_user.full_name || conversation.other_user.username}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                @{conversation.other_user.username}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              {conversation.unread_count && conversation.unread_count > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                                </Badge>
                              )}
                              {conversation.deletion_request && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Deletion
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Deletion Request Alert */}
                          {conversation.deletion_request && (
                            <div className="px-4 pb-2">
                              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-xs">
                                  {conversation.deletion_request.requested_by === user?.id ? (
                                    <div className="space-y-2">
                                      <p>You requested to delete this conversation</p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => cancelDeletionRequest(conversation.id)}
                                        className="h-6 text-xs"
                                      >
                                        Cancel Request
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <p>
                                        {conversation.other_user.full_name || conversation.other_user.username} wants to
                                        delete this conversation
                                      </p>
                                      <div className="flex space-x-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => approveDeletionRequest(conversation.id)}
                                          className="h-6 text-xs"
                                        >
                                          Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => cancelDeletionRequest(conversation.id)}
                                          className="h-6 text-xs"
                                        >
                                          Decline
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </AlertDescription>
                              </Alert>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <p>No conversations yet</p>
                      <p className="text-sm">Search for users to start chatting</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="md:col-span-2">
              {selectedConversation && selectedConvData ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={selectedConvData.other_user.avatar_url || ""}
                            alt={selectedConvData.other_user.username}
                          />
                          <AvatarFallback>
                            {selectedConvData.other_user.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">
                            {selectedConvData.other_user.full_name || selectedConvData.other_user.username}
                          </h3>
                          <p className="text-sm text-muted-foreground">@{selectedConvData.other_user.username}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDeleteConversationDialog(true)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Conversation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col h-[400px]">
                    <ScrollArea className="flex-1 p-4">
                      {messagesLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : messages.length > 0 ? (
                        <div className="space-y-4">
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex group ${message.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                                  message.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"
                                }`}
                              >
                                <p className="text-sm">{message.content}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs opacity-70">
                                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                  </p>
                                  {message.sender_id === user?.id && message.read_at && (
                                    <p className="text-xs opacity-70">Read</p>
                                  )}
                                </div>
                                {message.sender_id === user?.id && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                      >
                                        <MoreHorizontal className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setDeleteMessageDialog({
                                            open: true,
                                            messageId: message.id,
                                            senderId: message.sender_id,
                                          })
                                        }
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Message
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full text-muted-foreground">
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      )}
                    </ScrollArea>

                    <TypingIndicator
                      conversationId={selectedConversation}
                      otherUserId={selectedConvData.other_user.id}
                    />

                    <form onSubmit={sendMessage} className="p-4 border-t">
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={handleInputChange}
                          disabled={sending}
                          className="flex-1"
                        />
                        <Button type="submit" disabled={!newMessage.trim() || sending}>
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-full">
                  <div className="text-center text-muted-foreground">
                    <p>Select a conversation to start chatting</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* Delete Message Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteMessageDialog.open}
        onOpenChange={(open) => setDeleteMessageDialog({ ...deleteMessageDialog, open })}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete Message"
        cancelText="Cancel"
        onConfirm={confirmDeleteMessage}
        loading={deletingMessage}
        variant="destructive"
      />

      {/* Delete Conversation Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConversationDialog}
        onOpenChange={setDeleteConversationDialog}
        title="Request Conversation Deletion"
        description="This will send a deletion request to the other participant. The conversation will only be deleted if both participants agree. The request will expire in 7 days."
        confirmText="Send Request"
        cancelText="Cancel"
        onConfirm={requestConversationDeletion}
        loading={deletingConversation}
        variant="destructive"
      />
    </>
  )
}
