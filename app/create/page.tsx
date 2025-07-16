import { CreatePost } from "@/components/posts/create-post"
import { Navbar } from "@/components/layout/navbar"

export default function CreatePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <div className="px-2 md:px-0">
          <CreatePost />
        </div>
      </main>
    </div>
  )
}
