"use client"

import { useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProfileSettingsInput } from "./schemas"

type ImageChange = ProfileSettingsInput["avatar"]

export function SettingsImagePicker({
  disabled,
  initialUrl,
  label,
  onChange,
  round = false,
}: {
  disabled: boolean
  initialUrl: string | null
  label: string
  onChange: (change: ImageChange, previewUrl: string | null) => void
  round?: boolean
}) {
  const [previewUrl, setPreviewUrl] = useState(initialUrl)
  const [error, setError] = useState("")
  const [inputKey, setInputKey] = useState(0)

  async function choose(file: File | undefined) {
    setError("")
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.")
      setInputKey((value) => value + 1)
      return
    }
    if (file.size > 1_048_576) {
      setError("The image must be smaller than 1 MB.")
      setInputKey((value) => value + 1)
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }).catch(() => "")
    if (!dataUrl) {
      setError("We couldn't read this image. Choose another file.")
      return
    }
    setPreviewUrl(dataUrl)
    onChange({
      action: "replace",
      dataUrl,
      mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
    }, dataUrl)
  }

  function remove() {
    setPreviewUrl(null)
    setError("")
    setInputKey((value) => value + 1)
    onChange({ action: "remove" }, null)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div
        aria-label={`${label} preview`}
        className={cn(
          "flex size-20 shrink-0 items-center justify-center border bg-muted bg-cover bg-center text-muted-foreground",
          round ? "rounded-full" : "rounded-xl",
        )}
        role="img"
        style={previewUrl ? { backgroundImage: `url(${JSON.stringify(previewUrl)})` } : undefined}
      >
        {!previewUrl ? <ImagePlus aria-hidden="true" className="size-6" /> : null}
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <label className={cn(
            "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
          )}>
            <ImagePlus aria-hidden="true" className="size-3.5" />
            {previewUrl ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled}
              key={inputKey}
              onChange={(event) => void choose(event.currentTarget.files?.[0])}
              type="file"
            />
          </label>
          {previewUrl ? (
            <Button disabled={disabled} onClick={remove} size="sm" type="button" variant="outline">
              <Trash2 aria-hidden="true" />Remove
            </Button>
          ) : null}
        </div>
        <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error || "JPEG, PNG, or WebP · maximum 1 MB."}
        </p>
      </div>
    </div>
  )
}
