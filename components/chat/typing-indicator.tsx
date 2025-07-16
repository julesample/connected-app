"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"

interface TypingIndicatorProps {
  conversationId: string
  otherUserId: string
}

export function TypingIndicator({ conversationId, otherUserId }: TypingIndicatorProps) {
  const { user } = useAuth()
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false)

  useEffect(() => {
    if (!conversationId || !user) return

    const channel = supabase.channel(`typing:${conversationId}`)

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user_id === otherUserId && payload.user_id !== user.id) {
          setIsOtherUserTyping(true)

          // Auto-hide typing indicator after 3 seconds
          setTimeout(() => {
            setIsOtherUserTyping(false)
          }, 3000)
        }
      })
      .on("broadcast", { event: "stop_typing" }, ({ payload }) => {
        if (payload.user_id === otherUserId && payload.user_id !== user.id) {
          setIsOtherUserTyping(false)
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [conversationId, otherUserId, user])

  if (!isOtherUserTyping) return null

  return (
    <div className="flex items-center space-x-2 p-2 text-sm text-muted-foreground border-t">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
      </div>
      <span>Typing...</span>
    </div>
  )
}
