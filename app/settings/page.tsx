"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/layout/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Upload, Trash2, Shield, User, Activity, Lock } from "lucide-react"
import { supabase, applyMigrations } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { updatePassword, deleteAccount, verifyPassword } from "@/lib/auth"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { BlockedUsersSection } from "@/components/settings/blocked-users-section"
import { ActivityLogSection } from "@/components/settings/activity-log-section"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [deleteAccountDialog, setDeleteAccountDialog] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [migrating, setMigrating] = useState(false)

  // Profile form state
  const [fullName, setFullName] = useState("")
  const [bio, setBio] = useState("")
  const [website, setWebsite] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Privacy state
  // Removed isPrivate state and related handlers for Private Account feature

  // Account deletion state
  const [deletePassword, setDeletePassword] = useState("")

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

      if (error) {
        console.error("Error fetching profile:", error)
      } else if (data) {
        setProfile(data)
        setFullName(data.full_name || "")
        setBio(data.bio || "")
        setWebsite(data.website || "")
        setAvatarPreview(data.avatar_url || "")
        // Removed setIsPrivate call as isPrivate state is removed
      }
    } catch (error) {
      console.error("Profile fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Avatar must be less than 2MB",
          variant: "destructive",
        })
        return
      }

      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${user?.id}-avatar.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage.from("images").upload(filePath, file, {
        upsert: true,
      })

      if (uploadError) {
        console.error("Error uploading avatar:", uploadError)
        return null
      }

      const { data } = supabase.storage.from("images").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error("Upload error:", error)
      return null
    }
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || saving) return

    setSaving(true)

    try {
      let avatarUrl = profile?.avatar_url || ""

      if (avatarFile) {
        const uploadedUrl = await uploadAvatar(avatarFile)
        if (uploadedUrl) {
          avatarUrl = uploadedUrl
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          bio: bio.trim(),
          website: website.trim(),
          avatar_url: avatarUrl,
        })
        .eq("id", user.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Profile updated successfully!",
      })

      fetchProfile() // Refresh profile data
    } catch (error: any) {
      console.error("Profile update error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleMigration = async () => {
    setMigrating(true)
    await applyMigrations()
    setMigrating(false)
    toast({
      title: "Success",
      description: "Database migration applied successfully!",
    })
    // It's probably a good idea to reload the page to reflect the changes
    window.location.reload()
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || passwordLoading) return

    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Please enter your current password",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    setPasswordLoading(true)

    try {
      const isCurrentPasswordValid = await verifyPassword(currentPassword)

      if (!isCurrentPasswordValid) {
        toast({
          title: "Error",
          description: "Current password is incorrect",
          variant: "destructive",
        })
        setPasswordLoading(false)
        return
      }

      const { error } = await updatePassword(newPassword)

      if (error) throw error

      toast({
        title: "Success",
        description: "Password updated successfully!",
      })

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      console.error("Password update error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  const confirmDeleteAccount = async () => {
    if (!user || deletingAccount || !deletePassword.trim()) return

    setDeletingAccount(true)

    try {
      const { error } = await deleteAccount(deletePassword)

      if (error) {
        throw error
      }

      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted",
      })
    } catch (error: any) {
      console.error("Account deletion error:", error)
      toast({
        title: "Error",
        description:
          error.message === "Invalid password"
            ? "Incorrect password. Please try again."
            : error.message || "Failed to delete account",
        variant: "destructive",
      })
    } finally {
      setDeletingAccount(false)
      setDeleteAccountDialog(false)
      setDeletePassword("")
    }
  }

  const handlePrivacyChange = async (checked: boolean) => {
    // Removed handler for Private Account toggle
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

  return (
    <>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile" className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Profile</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Security</span>
                </TabsTrigger>
                <TabsTrigger value="privacy" className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Privacy</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Activity</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-6">
                {/* Profile Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your profile details and avatar.</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleProfileSave}>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={avatarPreview || ""} alt="Avatar" />
                          <AvatarFallback>{profile?.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarSelect}
                            className="hidden"
                            id="avatar-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById("avatar-upload")?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Change Avatar
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Tell us about yourself"
                          maxLength={160}
                        />
                        <p className="text-sm text-muted-foreground">{bio.length}/160</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          placeholder="https://yourwebsite.com"
                          type="url"
                        />
                      </div>

                      <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Profile
                      </Button>
                    </CardContent>
                  </form>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-6">
                {/* Password Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your account password.</CardDescription>
                  </CardHeader>
                  <form onSubmit={handlePasswordChange}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          minLength={6}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          minLength={6}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          minLength={6}
                        />
                      </div>

                      <Button type="submit" disabled={passwordLoading || !newPassword || !currentPassword}>
                        {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Password
                      </Button>
                    </CardContent>
                  </form>
                </Card>

                {/* Danger Zone */}
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteAccountDialog(true)}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="privacy" className="space-y-6">
                {/* Removed Private Account privacy settings */}
                <BlockedUsersSection />
              </TabsContent>

              <TabsContent value="activity" className="space-y-6">
                <ActivityLogSection />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteAccountDialog}
        onOpenChange={(open) => {
          setDeleteAccountDialog(open)
          if (!open) setDeletePassword("")
        }}
        title="Delete Account"
        description={
          <div className="space-y-4">
            <p>
              Are you absolutely sure you want to delete your account? This will permanently delete your profile, posts,
              comments, messages, and all associated data. This action cannot be undone.
            </p>
            <div className="space-y-2">
              <Label htmlFor="deletePassword" className="text-sm font-medium">
                Enter your password to confirm:
              </Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your current password"
                className="w-full"
              />
            </div>
          </div>
        }
        confirmText="Delete Account"
        cancelText="Cancel"
        onConfirm={confirmDeleteAccount}
        loading={deletingAccount}
        variant="destructive"
      />
    </>
  )
}
