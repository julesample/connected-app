"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { UserCard } from "./user-card"
import { Skeleton } from "@/components/ui/skeleton"

interface Profile {
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

export function SuggestedUsers() {
  const { user } = useAuth()
  const [suggestedUsers, setSuggestedUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSuggestedUsers()
  }, [user])

  const fetchSuggestedUsers = async () => {
    if (!user) {
      setSuggestedUsers([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Fetch users excluding current user and users already followed
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)

      const followingIds = followingData?.map((f) => f.following_id) || []

      const { data: usersData, error } = await supabase
        .from("profiles")
        .select("*")
        .not("id", "in", `(${[user.id, ...followingIds].join(",")})`)
        .limit(10)

      if (error) {
        console.error("Error fetching suggested users:", error)
        setSuggestedUsers([])
      } else {
        setSuggestedUsers(usersData || [])
      }
    } catch (error) {
      console.error("Error fetching suggested users:", error)
      setSuggestedUsers([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    // Render 4 skeleton user cards as placeholders
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold mb-4">Suggested Users</h2>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-2 border rounded-md">
            <Skeleton className="rounded-full h-10 w-10" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-4 rounded w-1/3" />
              <Skeleton className="h-3 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (suggestedUsers.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No suggested users found.</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold mb-4">Suggested Users</h2>
      <div className="space-y-4">
        {suggestedUsers.map((profile) => (
          <UserCard key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  )
}
