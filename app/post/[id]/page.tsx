"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Navbar } from "@/components/layout/navbar"
import { PostCard } from "@/components/posts/post-card"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

export default function PostPage() {
  const params = useParams()
  const postId = params.id as string

  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (postId) {
      fetchPost()
    }
  }, [postId])

  const fetchPost = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq("id", postId)
      .single()

    if (error) {
      console.error("Error fetching post:", error)
    } else {
      setPost(data)
    }

    setLoading(false)
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

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="text-center px-2 md:px-0">
            <h1 className="text-xl md:text-2xl font-bold">Content Not Available</h1>
            <p className="text-muted-foreground">This post is only available to approved followers.</p>
          </div>
        </main>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="text-center px-2 md:px-0">
            <h1 className="text-xl md:text-2xl font-bold">Post not found</h1>
            <p className="text-muted-foreground">The post you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <div className="max-w-2xl mx-auto">
          <PostCard post={post} />
        </div>
      </main>
    </div>
  )
}
