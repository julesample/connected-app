"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe, Users, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface EditPostDialogProps {
  post: {
    id: string
    content: string
    privacy?: string
  }
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export const EditPostDialog: React.FC<EditPostDialogProps> = ({ post, isOpen, onClose, onSave }) => {
  const { toast } = useToast()
  const [content, setContent] = useState(post.content)
  const [privacy, setPrivacy] = useState(post.privacy || "public")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setContent(post.content)
    setPrivacy(post.privacy || "public")
  }, [post])

  const handleSave = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from("posts")
        .update({ content, privacy })
        .eq("id", post.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Post updated successfully",
      })
      onSave()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update post",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mb-4"
          rows={5}
          maxLength={500}
          disabled={loading}
        />
        <Select value={privacy} onValueChange={setPrivacy} disabled={loading}>
          <SelectTrigger>
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
          <SelectItem value="only_me">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-blue-500" />
              <span>Only Me</span>
            </div>
          </SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !content.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
