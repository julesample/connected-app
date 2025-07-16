import type React from "react"
import ClientLayout from "./clientLayout"
import './globals.css'

export const metadata = {
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
