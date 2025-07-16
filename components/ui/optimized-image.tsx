"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  priority?: boolean
}

export function OptimizedImage({ src, alt, width, height, className, fill, priority }: OptimizedImageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleLoad = () => {
    setLoading(false)
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <span className="text-muted-foreground text-sm">Failed to load image</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <Image
        src={src || "/placeholder.svg"}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        priority={priority}
        className={`transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"} ${
          fill ? "object-cover" : ""
        }`}
        onLoad={handleLoad}
        onError={handleError}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  )
}
