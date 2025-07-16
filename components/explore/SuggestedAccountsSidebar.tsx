"use client"

import { useEffect, useState } from "react"
import { UserCard } from "@/components/users/user-card"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

interface Profile {
  id: string
  username: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  is_private: boolean
  website: string | null
  followers_count: number
  following_count: number
  posts_count: number
}

export function SuggestedAccountsSidebar() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSuggestedAccounts()
  }, [])

  const fetchSuggestedAccounts = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get current user id
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setProfiles([])
        setLoading(false)
        return
      }

      // Exclude only current user
      const excludeIds = [user.id]

      // Fetch recently created public profiles excluding current user
      let query = supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url, is_private, website, followers_count, following_count, posts_count")
        // Removed is_private filter to include private profiles as well
        .order("created_at", { ascending: false })
        .limit(5)

      if (excludeIds.length > 0) {
        const excludeIdsString = excludeIds.map(id => `"${id}"`).join(",")
        query = query.not("id", "in", excludeIdsString)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching suggested accounts:", error)
        setError("Failed to load suggested accounts.")
        setProfiles([])
      } else {
        setProfiles(data || [])
      }
    } catch (error) {
      console.error("Unexpected error fetching suggested accounts:", error)
      setError("Unexpected error occurred while loading suggestions.")
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-red-600 text-center">{error}</div>
  }

  if (profiles.length === 0) {
    return <div className="p-4 text-muted-foreground text-center">No suggested accounts found.</div>
  }

  return (
    <aside className="hidden md:block w-72 p-4 border rounded-md bg-white shadow-sm sticky top-20 max-h-[600px] overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Accounts to Follow</h2>
      <div className="space-y-4">
        {profiles.map((profile) => (
          <UserCard key={profile.id} profile={profile} />
        ))}
      </div>
    </aside>
  )
}
