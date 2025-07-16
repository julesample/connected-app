"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface Follower {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
}

interface AudienceSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedFollowers: string[]) => void;
}

export function AudienceSelectDialog({ isOpen, onClose, onSelect }: AudienceSelectDialogProps) {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [selectedFollowers, setSelectedFollowers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      fetchFollowers();
    }
  }, [isOpen, user]);

  const fetchFollowers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("followers")
        .select("follower_id, profiles!inner(id, username, full_name, avatar_url)")
        .eq("followed_id", user.id);

      if (error) throw error;

      const followerProfiles = data.map((item: any) => item.profiles);
      setFollowers(followerProfiles);
    } catch (error) {
      console.error("Error fetching followers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFollower = (followerId: string) => {
    setSelectedFollowers((prev) =>
      prev.includes(followerId)
        ? prev.filter((id) => id !== followerId)
        : [...prev, followerId]
    );
  };

  const handleConfirm = () => {
    onSelect(selectedFollowers);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Audience</DialogTitle>
          <DialogDescription>
            Choose which followers can see this post.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-4 p-1">
          {loading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : followers.length > 0 ? (
            followers.map((follower) => (
              <div
                key={follower.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => handleSelectFollower(follower.id)}
              >
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src={follower.avatar_url} />
                    <AvatarFallback>{follower.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{follower.full_name}</p>
                    <p className="text-sm text-muted-foreground">@{follower.username}</p>
                  </div>
                </div>
                <Checkbox
                  checked={selectedFollowers.includes(follower.id)}
                  onCheckedChange={() => handleSelectFollower(follower.id)}
                />
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground">You don't have any followers yet.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
