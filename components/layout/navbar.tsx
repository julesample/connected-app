"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Home, Search, PlusSquare, User, LogOut, Settings, Menu, MessageCircle, Info } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { signOut } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { useToast } from "@/hooks/use-toast"

export function Navbar() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const profileUrl = profile ? `/profile/${profile.username}` : "#"
  const [isOpen, setIsOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return

    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      setProfile(data)
    } catch (error) {
      console.error("Error fetching profile:", error)
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return

    setSigningOut(true)
    setIsOpen(false)

    try {
      const { error } = await signOut()

      if (error) {
        toast({
          title: "Error",
          description: "Failed to sign out. Please try again.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Signed out successfully",
        })
        // The signOut function will handle the redirect
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setSigningOut(false)
    }
  }

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "/create", icon: PlusSquare, label: "Create" },
    { href: "/chat", icon: MessageCircle, label: "Chat" },
  ]

  if (!user) return null

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">
          Connected
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-4">
          {navItems.map((item) => (
            <Button key={item.href} variant="ghost" size="icon" asChild>
              <Link href={item.href} legacyBehavior passHref>
                <a>
                  <item.icon className="h-5 w-5" />
                </a>
              </Link>
            </Button>
          ))}

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} alt={profile?.username} />
                  <AvatarFallback>{profile?.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              {profile && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={profileUrl} className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/about-us" className="flex items-center">
                      <Info className="mr-2 h-4 w-4" />
                      <span>About Us</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} disabled={signingOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col space-y-4 mt-8">
                <div className="flex items-center space-x-3 pb-4 border-b">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} alt={profile?.username} />
                    <AvatarFallback>{profile?.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{profile?.full_name || profile?.username}</p>
                    <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                  </div>
                </div>

                <div className="flex justify-center pb-2">
                  <NotificationBell />
                </div>

                {navItems.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className="justify-start"
                    asChild
                    onClick={() => setIsOpen(false)}
                  >
                    <Link href={item.href}>
                      <item.icon className="mr-2 h-5 w-5" />
                      {item.label}
                    </Link>
                  </Button>
                ))}

                {profile && (
                  <>
                  <Button variant="ghost" className="justify-start" asChild onClick={() => setIsOpen(false)}>
                    <Link href={profileUrl} legacyBehavior passHref>
                      <a>
                        <User className="mr-2 h-5 w-5" />
                        Profile
                      </a>
                    </Link>
                  </Button>

                    <Button variant="ghost" className="justify-start" asChild onClick={() => setIsOpen(false)}>
                      <Link href="/settings" legacyBehavior passHref>
                        <a>
                          <Settings className="mr-2 h-5 w-5" />
                          Settings
                        </a>
                      </Link>
                    </Button>

                    <Button variant="ghost" className="justify-start" asChild onClick={() => setIsOpen(false)}>
                      <Link href="/about-us" legacyBehavior passHref>
                        <a>
                          <Info className="mr-2 h-5 w-5" />
                          About Us
                        </a>
                      </Link>
                    </Button>

                    <Button variant="ghost" className="justify-start" onClick={handleSignOut} disabled={signingOut}>
                      <LogOut className="mr-2 h-5 w-5" />
                      {signingOut ? "Signing out..." : "Sign out"}
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
