"use client"

interface ImageOptimizerProps {
  file: File
  maxWidth?: number
  maxHeight?: number
  quality?: number
  onOptimized: (optimizedFile: File) => void
  onError?: (error: string) => void
}

export function useImageOptimizer() {
  const optimizeImage = async (
    file: File,
    options: {
      maxWidth?: number
      maxHeight?: number
      quality?: number
    } = {},
  ): Promise<File> => {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options

    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }

        // Set canvas dimensions
        canvas.width = width
        canvas.height = height

        // Draw and compress image
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(optimizedFile)
            } else {
              reject(new Error("Failed to optimize image"))
            }
          },
          "image/jpeg",
          quality,
        )
      }

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      img.src = URL.createObjectURL(file)
    })
  }

  return { optimizeImage }
}
