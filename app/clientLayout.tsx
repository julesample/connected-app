"use client"

import type React from "react"

import { Inter } from "next/font/google"
import "./globals.css"
import { useAuth } from "@/hooks/use-auth"
import { AuthForm } from "@/components/auth/auth-form"
import { Toaster } from "@/components/ui/toaster"
import { usePathname, useRouter } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { useEffect } from "react"

const inter = Inter({ subsets: ["latin"] })

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // If user is authenticated and on auth page, redirect to home
    if (user && pathname === "/auth") {
      router.push("/")
    }
  }, [user, pathname, router])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-background ${inter.className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Show auth form if user is not authenticated and not on auth page
  if (!user && pathname !== "/auth") {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 bg-blue-950 ${inter.className}`}>
        <AuthForm />
        <Toaster />
      </div>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <div className={inter.className}>
        {children}
        <Toaster />
      </div>
    </ThemeProvider>
  )
}
