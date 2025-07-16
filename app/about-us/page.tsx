"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AboutUs() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8">
      <Button onClick={() => router.back()} className="mb-4">
        Back
      </Button>
      <h1 className="text-3xl font-bold mb-4">About Us</h1>
      <p className="text-lg">
        Our application is a social platform designed to connect people through shared experiences. 
        Users can create and share posts, follow others to see their content, and engage in private conversations. 
        With robust privacy controls, you can customize who sees your posts and manage your account's visibility. 
        Our goal is to provide a secure and personalized environment for you to interact with others and build meaningful connections.
      </p>
    </div>
  );
}
