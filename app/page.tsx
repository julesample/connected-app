import { PostFeed } from "@/components/posts/post-feed"
import { Navbar } from "@/components/layout/navbar"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 px-2 md:px-0">Your Feed</h1>
          <PostFeed feedType="home" />
        </div>
      </main>
    </div>
  )
}
