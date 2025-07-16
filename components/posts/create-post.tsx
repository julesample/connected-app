"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageIcon, X, Loader2, Globe, Users, Lock, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useEffect } from "react"
import { useImageOptimizer } from "./image-optimizer"
import { moderateContent } from "@/lib/content-moderation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AudienceSelectDialog } from "./audience-select-dialog"

export function CreatePost() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const { optimizeImage } = useImageOptimizer()
  const [content, setContent] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [privacy, setPrivacy] = useState("public")
  const [imageOptimizing, setImageOptimizing] = useState(false)
  const [contentWarning, setContentWarning] = useState<string | null>(null)
  const [isAudienceDialogOpen, setIsAudienceDialogOpen] = useState(false)
  const [selectedAudience, setSelectedAudience] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  useEffect(() => {
    // Check content for moderation in real-time
    if (content.trim()) {
      const moderation = moderateContent(content)
      if (!moderation.isClean) {
        setContentWarning(moderation.reason || "Content may be inappropriate")
      } else {
        setContentWarning(null)
      }
    } else {
      setContentWarning(null)
    }
  }, [content])

  const fetchProfile = async () => {
    if (!user) return

    setProfileLoading(true)
    try {
      // First try to get existing profile
      const { data: existingProfile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        console.error("Error fetching profile:", error)
        // If profile doesn't exist, create one
        await createProfileIfMissing()
      } else if (existingProfile) {
        setProfile(existingProfile)
      } else {
        // Profile doesn't exist, create it
        await createProfileIfMissing()
      }
    } catch (error) {
      console.error("Profile fetch error:", error)
      await createProfileIfMissing()
    } finally {
      setProfileLoading(false)
    }
  }

  const createProfileIfMissing = async () => {
    if (!user) return

    try {
      // Try to create profile using RPC function
      const { error: rpcError } = await supabase.rpc("create_profile_for_user", {
        user_id: user.id,
        user_email: user.email || "",
        user_username: user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`,
        user_full_name: user.user_metadata?.full_name || user.user_metadata?.fullName || "User",
      })

      if (rpcError) {
        console.error("RPC error:", rpcError)
      }

      // Try to fetch the profile again
      const { data: newProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

      if (newProfile) {
        setProfile(newProfile)
      } else {
        // Create a temporary profile object for the UI
        setProfile({
          id: user.id,
          username: user.email?.split("@")[0] || "user",
          full_name: user.user_metadata?.full_name || user.user_metadata?.fullName || "User",
          avatar_url: user.user_metadata?.avatar_url || "",
        })
      }
    } catch (error) {
      console.error("Error creating profile:", error)
      // Create a temporary profile object for the UI
      setProfile({
        id: user.id,
        username: user.email?.split("@")[0] || "user",
        full_name: user.user_metadata?.full_name || user.user_metadata?.fullName || "User",
        avatar_url: user.user_metadata?.avatar_url || "",
      })
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image must be less than 5MB",
          variant: "destructive",
        })
        return
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Please select a valid image file",
          variant: "destructive",
        })
        return
      }

      setImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImage(null)
    setImagePreview(null)
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop() || "jpg"
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const filePath = `posts/${fileName}`

      // Upload the file
      const { error: uploadError } = await supabase.storage.from("images").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (uploadError) {
        console.error("Error uploading image:", uploadError)
        return null
      }

      // Get the public URL
      const { data } = supabase.storage.from("images").getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error("Upload error:", error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !content.trim()) return

    // Check content moderation
    const moderation = moderateContent(content)
    if (!moderation.isClean) {
      toast({
        title: "Content Blocked",
        description: moderation.reason || "Your content contains inappropriate language",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      let imageUrl = null
      if (image) {
        imageUrl = await uploadImage(image)
        if (!imageUrl) {
          throw new Error("Failed to upload image")
        }
      }

      const postData: any = {
        user_id: user.id,
        content: content.trim(),
        image_url: imageUrl,
        privacy: privacy,
      };

      if (privacy === "private" && selectedAudience.length > 0) {
        postData.allowed_users = selectedAudience;
      }

      const { error } = await supabase.from("posts").insert(postData);

      if (error) throw error

      toast({
        title: "Success",
        description: "Post created successfully!",
      })

      // Reset form
      setContent("")
      setImage(null)
      setImagePreview(null)
      setPrivacy("public")
      setContentWarning(null)
      setSelectedAudience([])

      // Navigate to home
      router.push("/")
    } catch (error: any) {
      console.error("Post creation error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex justify-center py-8">
        <p>Please sign in to create a post.</p>
      </div>
    )
  }

  if (profileLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg md:text-xl">Create a new post</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url || ""} alt={profile?.username} />
              <AvatarFallback>{profile?.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <Textarea
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px] md:min-h-[120px] resize-none border-none p-0 focus-visible:ring-0 text-sm md:text-base"
                maxLength={500}
                disabled={loading}
              />
              <div className="text-right text-xs md:text-sm text-muted-foreground mt-2">{content.length}/500</div>
            </div>
          </div>

          {contentWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{contentWarning}</AlertDescription>
            </Alert>
          )}

          {imagePreview && (
            <div className="relative">
              <div className="relative aspect-square w-full max-w-md rounded-lg overflow-hidden">
                <Image src={imagePreview || "/placeholder.svg"} alt="Preview" fill className="object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeImage}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
                disabled={loading || imageOptimizing}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById("image-upload")?.click()}
                className="text-xs md:text-sm"
                disabled={loading || imageOptimizing}
              >
                {imageOptimizing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4 mr-2" />
                )}
                {imageOptimizing ? "Optimizing..." : "Add Image"}
              </Button>

              <Select
                value={privacy}
                onValueChange={(value) => {
                  setPrivacy(value)
                  if (value === "private") {
                    setIsAudienceDialogOpen(true)
                  }
                }}
                disabled={loading}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="followers">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Followers Only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4" />
                      <span>Private (Select Audience)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={
                !content.trim() ||
                loading ||
                imageOptimizing ||
                !!contentWarning ||
                (privacy === "private" && selectedAudience.length === 0)
              }
              size="sm"
              className="px-6"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Posting..." : "Post"}
            </Button>
          </div>
        </CardContent>
      </form>
      <AudienceSelectDialog
        isOpen={isAudienceDialogOpen}
        onClose={() => setIsAudienceDialogOpen(false)}
        onSelect={(audience) => {
          setSelectedAudience(audience)
          if (audience.length === 0) {
            setPrivacy("public") // Revert to public if no one is selected
          }
        }}
      />
    </Card>
  )
}
