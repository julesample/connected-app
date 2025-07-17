import { PostFeed } from "@/components/posts/post-feed"
import { Navbar } from "@/components/layout/navbar"
import { SuggestedUsers } from "@/components/users/suggested-users"

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 px-2 md:px-0">Explore</h1>
        <div className="flex justify-center max-w-5xl mx-auto flex-col md:flex-row md:space-x-6">
          <div className="w-full max-w-2xl max-h-[60vh] md:max-h-[80vh] overflow-y-auto">
            <PostFeed feedType="explore" />
          </div>
          <div className="w-full max-w-md mt-6 md:mt-0">
            <SuggestedUsers />
          </div>
        </div>
      </main>
    </div>
  )
}
