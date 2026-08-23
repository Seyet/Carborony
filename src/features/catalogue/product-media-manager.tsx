"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, ImageIcon, Star, Trash2, Video } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { postJson } from "@/lib/api/client"
import type { MediaMutationData } from "./api-types"
import type { ProductMediaItem } from "./types"

export function ProductMediaManager({
  initialMedia,
  productId,
}: {
  initialMedia: ProductMediaItem[]
  productId: string
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialMedia)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function manage(payload: object) {
    return postJson<MediaMutationData>(`/api/catalogue/products/${productId}/media`, {
      operation: "manage",
      payload,
    })
  }

  async function setPrimary(mediaId: string) {
    if (pendingId) return
    setPendingId(mediaId)
    const response = await manage({ action: "primary", mediaId })
    setPendingId(null)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    setItems((current) => current.map((item) => ({
      ...item,
      isPrimary: item.id === mediaId,
    })))
    toast.success(response.message ?? "Primary image updated.")
    router.refresh()
  }

  async function deleteMedia(item: ProductMediaItem) {
    if (pendingId || !window.confirm(`Delete “${item.fileName}”?`)) return
    setPendingId(item.id)
    const response = await manage({ action: "delete", mediaId: item.id })
    setPendingId(null)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    setItems((current) => {
      const remaining = current.filter((media) => media.id !== item.id)
      if (item.isPrimary) {
        const nextImage = remaining.find((media) => media.kind === "image" && !media.variantId)
        return remaining.map((media) => ({ ...media, isPrimary: media.id === nextImage?.id }))
      }
      return remaining
    })
    toast.success(response.message ?? "Media deleted.")
    router.refresh()
  }

  async function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (pendingId || targetIndex < 0 || targetIndex >= items.length) return
    const previous = items
    const reordered = [...items]
    const currentItem = reordered[index]
    const targetItem = reordered[targetIndex]
    if (!currentItem || !targetItem) return
    reordered[index] = targetItem
    reordered[targetIndex] = currentItem
    setItems(reordered)
    setPendingId(currentItem.id)
    const response = await manage({
      action: "reorder",
      orderedIds: reordered.map((item) => item.id),
    })
    setPendingId(null)
    if (!response.ok) {
      setItems(previous)
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Media order updated.")
    router.refresh()
  }

  if (!items.length) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No uploaded media yet. Choose files below and save the product.</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <article className="overflow-hidden rounded-xl border bg-background" key={item.id}>
          <div className="relative flex aspect-video items-center justify-center bg-muted text-muted-foreground">
            {item.kind === "image" ? (
              <Image alt={item.fileName} className="object-cover" fill sizes="(max-width: 640px) 100vw, 320px" src={item.publicUrl} unoptimized />
            ) : <Video aria-hidden="true" className="size-8" />}
            <div className="absolute top-2 left-2 flex gap-1">
              {item.isPrimary ? <Badge><Star aria-hidden="true" className="size-3" />Primary</Badge> : null}
              {item.variantName ? <Badge variant="secondary">{item.variantName}</Badge> : null}
            </div>
          </div>
          <div className="flex items-center gap-1 p-2">
            <span className="min-w-0 flex-1 truncate px-1 text-xs">{item.fileName}</span>
            <Button aria-label="Move media left" disabled={Boolean(pendingId) || index === 0} onClick={() => move(index, -1)} size="icon-sm" type="button" variant="ghost"><ArrowLeft aria-hidden="true" /></Button>
            <Button aria-label="Move media right" disabled={Boolean(pendingId) || index === items.length - 1} onClick={() => move(index, 1)} size="icon-sm" type="button" variant="ghost"><ArrowRight aria-hidden="true" /></Button>
            {item.kind === "image" && !item.variantId && !item.isPrimary ? <Button aria-label="Set as primary image" disabled={Boolean(pendingId)} onClick={() => setPrimary(item.id)} size="icon-sm" type="button" variant="ghost"><ImageIcon aria-hidden="true" /></Button> : null}
            <Button aria-label="Delete media" disabled={Boolean(pendingId)} onClick={() => deleteMedia(item)} size="icon-sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button>
          </div>
        </article>
      ))}
    </div>
  )
}
