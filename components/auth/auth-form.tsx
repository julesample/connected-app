"use client"

import Link from "next/link";
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { signIn, signUp } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"

export function AuthForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const [mathProblem, setMathProblem] = useState({ num1: 0, num2: 0, operation: '+', answer: 0 });
  const [userAnswer, setUserAnswer] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  const generateMathProblem = () => {
    const operations = ['+', '-', 'x', '÷'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1 = 0, num2 = 0, answer = 0;

    switch (operation) {
      case '+':
        num1 = Math.floor(Math.random() * 20) + 1;
        num2 = Math.floor(Math.random() * 20) + 1;
        answer = num1 + num2;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 20) + 1;
        num2 = Math.floor(Math.random() * num1) + 1;
        answer = num1 - num2;
        break;
      case 'x':
        num1 = Math.floor(Math.random() * 10) + 1;
        num2 = Math.floor(Math.random() * 10) + 1;
        answer = num1 * num2;
        break;
      case '÷':
        answer = Math.floor(Math.random() * 10) + 1;
        num2 = Math.floor(Math.random() * 10) + 1;
        num1 = answer * num2;
        break;
    }

    setMathProblem({ num1, num2, operation, answer });
  };

  useEffect(() => {
    generateMathProblem();
  }, []);

  // Update username when email changes
  useEffect(() => {
    const atIndex = email.indexOf("@");
    if (atIndex !== -1) {
      setUsername(email.substring(0, atIndex));
    } else {
      setUsername(email);
    }
  }, [email]);

  const handleSignIn = async (formData: FormData) => {
    setLoading(true)
    try {
      const email = formData.get("email") as string
      const password = formData.get("password") as string

      const { error } = await signIn(email, password)

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Signed in successfully!",
        })
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
    setLoading(false)
  }

  const handleSignUp = async (formData: FormData) => {
    setLoading(true)
    try {
      const password = formData.get("password") as string
      const fullName = formData.get("fullName") as string

      if (parseInt(userAnswer, 10) !== mathProblem.answer) {
        toast({
          title: "Error",
          description: "Incorrect answer to the math problem. Please try again.",
          variant: "destructive",
        });
        generateMathProblem();
        setLoading(false);
        return;
      }

      // Basic validation
      if (!username || username.trim().length < 3) {
        toast({
          title: "Error",
          description: "Username must be at least 3 characters long",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      if (!fullName || fullName.trim().length < 1) {
        toast({
          title: "Error",
          description: "Full name is required",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      if (password.length < 6) {
        toast({
          title: "Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      const { data, error } = await signUp(email, password, username.trim(), fullName.trim())

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Account created! Check your email for the confirmation link.",
        })
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "An unexpected error occurred during signup",
        variant: "destructive",
      })
    }
    setLoading(false)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl md:text-2xl">Welcome to Connected</CardTitle>
        <CardDescription className="text-sm md:text-base">{"A social media app that allows you to post,like,comment and connect with users."}</CardDescription>
      </CardHeader>
      <Tabs defaultValue="signin" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin" className="text-sm md:text-base">
            Sign In
          </TabsTrigger>
          <TabsTrigger value="signup" className="text-sm md:text-base">
            Sign Up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form action={handleSignIn}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-sm md:text-base">
                  Email
                </Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  className="text-sm md:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password" className="text-sm md:text-base">
                  Password
                </Label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  className="text-sm md:text-base"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button type="submit" className="w-full text-sm md:text-base" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </CardFooter>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form action={handleSignUp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-sm md:text-base">
                Email
              </Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                placeholder="Enter your email"
                required
                className="text-sm md:text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
              <div className="space-y-2">
              <Label htmlFor="signup-username" className="text-sm md:text-base">
                Username
              </Label>
              <Input
                id="signup-username"
                name="username"
                type="text"
                placeholder="Your username"
                required
                className="text-sm md:text-base bg-black cursor-not-allowed"
                disabled
                value={username}
                
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your username is automatically generated from your email by taking the part before '@'.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-fullname" className="text-sm md:text-base">
                Full Name
              </Label>
              <Input
                id="signup-fullname"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                required
                className="text-sm md:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-sm md:text-base">
                Password
              </Label>
              <Input
                id="signup-password"
                name="password"
                type="password"
                placeholder="Create a password (6+ characters)"
                required
                minLength={6}
                className="text-sm md:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="math-problem" className="text-sm md:text-base">
                Solve: {mathProblem.num1} {mathProblem.operation} {mathProblem.num2} = ?
              </Label>
              <Input
                id="math-problem"
                name="math-problem"
                type="number"
                placeholder="Your answer"
                required
                className="text-sm md:text-base"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full text-sm md:text-base" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign Up
            </Button>
          </CardFooter>
        </form>
      </TabsContent>
      </Tabs>
      <CardFooter className="flex justify-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="link" className="text-sm underline">
              About Info
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>About Us</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              <p className="text-sm mb-2">
                Our application is a social platform designed to connect people through shared experiences.
                Users can create and share posts, follow others to see their content, and engage in private conversations.
                With robust privacy controls, you can customize who sees your posts and manage your account's visibility.
                Our goal is to provide a secure and personalized environment for you to interact with others and build meaningful connections.
                Work in progress - we are constantly improving the platform to enhance user experience and add new features.
                Please feel free to reach out with any feedback or suggestions.
              </p>
              <p className="text-sm">
                Owned and maintained by <a href="https://julesample.vercel.app/" className="text-blue-600 underline">Julesample</a>
              </p>
            </DialogDescription>
            <DialogClose asChild>
              <Button className="mt-4">Close</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}
