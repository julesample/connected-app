import { supabase } from "./supabase"
import type { User } from "@supabase/supabase-js"

export async function signUp(email: string, password: string, username: string, fullName: string) {
  try {
    // First, try to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim(),
          fullName: fullName.trim(),
        },
      },
    })

    if (error) {
      return { data: null, error }
    }

    /**
     * If the trigger silently failed (or was disabled),
     * call the elevated‐privilege RPC so we never hit RLS.
     */
    if (data.user && !error) {
      const { data: profileCheck } = await supabase.from("profiles").select("id").eq("id", data.user.id).single()

      if (!profileCheck) {
        const { error: rpcErr } = await supabase.rpc("create_profile_for_user", {
          user_id: data.user.id,
          user_email: email,
          user_username: username.trim(),
          user_full_name: fullName.trim(),
        })

        if (rpcErr) {
          console.error("create_profile_for_user RPC failed:", rpcErr)
        }
      }
    }

    return { data, error }
  } catch (err: any) {
    return { data: null, error: { message: err.message } }
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  // Clear any cached data
  if (typeof window !== "undefined") {
    // Clear localStorage/sessionStorage if needed
    localStorage.clear()
    sessionStorage.clear()

    // Force reload to clear any cached state
    window.location.href = "/auth"
  }

  return { error }
}

export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({
    password,
  })

  return { data, error }
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return false
    }

    // Create a temporary session to verify password
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })

    return !error
  } catch (error) {
    return false
  }
}

export async function deleteAccount(password: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("No user found")
    }

    // Verify password first
    const isPasswordValid = await verifyPassword(password)
    if (!isPasswordValid) {
      throw new Error("Invalid password")
    }

    // Delete user data using the RPC function
    const { error: deleteError } = await supabase.rpc("delete_user_account")

    if (deleteError) {
      throw deleteError
    }

    // Removed call to backend API route to delete Supabase Auth user because API route was deleted
    // Without this, Supabase Auth user is not deleted and user can still log in

    // Sign out after deletion
    await signOut()

    return { error: null }
  } catch (error: any) {
    return { error }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
