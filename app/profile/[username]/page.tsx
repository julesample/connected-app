"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Navbar } from "@/components/layout/navbar"
import { PostFeed } from "@/components/posts/post-feed"
import { UserCard } from "@/components/users/user-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth" // Import useAuth hook
import { handleClientError } from "@/components/errors/use-error-handler" // Import error handler

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string

  const { user } = useAuth() // Get the current user

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (username) {
      fetchProfile()
    }
  }, [username, user]) // Add user to dependency array to re-fetch if auth state changes

  const fetchProfile = async () => {
    setLoading(true)

    // Fetch the target profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle()

    if (profileError) {
      handleClientError("Error fetching profile:", profileError)
      setProfile(null) // Ensure profile is null on error
      setLoading(false)
      return
    }

    if (!profileData) {
      setProfile(null) // User not found
      setLoading(false)
      return
    }

    setProfile(profileData)

    setLoading(false)
  }

  if (!username || username === "undefined") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="text-center px-2 md:px-0">
            <h1 className="text-xl md:text-2xl font-bold">User not found</h1>
            <p className="text-muted-foreground">The user @{username} does not exist.</p>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="text-center px-2 md:px-0">
            <h1 className="text-xl md:text-2xl font-bold">User not found</h1>
            <p className="text-muted-foreground">The user @{username} does not exist.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Enhanced User Profile Card */}
          <UserCard profile={profile} onProfileUpdate={fetchProfile} />

          {/* Posts Section with Scrollable Area */}
          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-semibold px-2 md:px-0">Posts</h2>
            <div className="border rounded-lg bg-card">
              <ScrollArea className="h-[600px] w-full">
                <div className="p-4">
                  <PostFeed feedType="profile" userId={profile.id} />
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
