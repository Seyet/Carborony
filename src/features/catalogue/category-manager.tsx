"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, FolderTree, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import type { CategoryMutationData } from "./api-types"
import type { CatalogueCategory } from "./types"

type CategoryDraft = {
  description: string
  isActive: boolean
  name: string
  parentId: string
}

const emptyDraft: CategoryDraft = {
  description: "",
  isActive: true,
  name: "",
  parentId: "",
}

export function CategoryManager({ categories }: { categories: CatalogueCategory[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [categories],
  )

  function edit(category: CatalogueCategory) {
    setEditingId(category.id)
    setDraft({
      description: category.description ?? "",
      isActive: category.isActive,
      name: category.name,
      parentId: category.parentId ?? "",
    })
  }

  function resetDraft() {
    setEditingId(null)
    setDraft(emptyDraft)
  }

  function setDraftField<Key extends keyof CategoryDraft>(
    key: Key,
    value: CategoryDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function saveCategory() {
    if (pending || draft.name.trim().length < 2) return
    setPending(true)
    const response = await postJson<CategoryMutationData>("/api/catalogue/categories", editingId
      ? {
          action: "update",
          categoryId: editingId,
          description: draft.description.trim() || null,
          isActive: draft.isActive,
          name: draft.name,
          parentId: draft.parentId || null,
        }
      : {
          action: "create",
          description: draft.description.trim() || null,
          name: draft.name,
          parentId: draft.parentId || null,
        })
    setPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Category saved.")
    resetDraft()
    router.refresh()
  }

  async function deleteCategory(category: CatalogueCategory) {
    if (pending || !window.confirm(`Delete “${category.name}”? This cannot be undone.`)) return
    setPending(true)
    const response = await postJson<CategoryMutationData>("/api/catalogue/categories", {
      action: "delete",
      categoryId: category.id,
    })
    setPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Category deleted.")
    if (editingId === category.id) resetDraft()
    router.refresh()
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const target = index + direction
    if (pending || target < 0 || target >= orderedCategories.length) return
    const orderedIds = orderedCategories.map((category) => category.id)
    ;[orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]]
    setPending(true)
    const response = await postJson<CategoryMutationData>("/api/catalogue/categories", {
      action: "reorder",
      orderedIds,
    })
    setPending(false)
    if (!response.ok) toast.error(response.error.message)
    else {
      toast.success(response.message ?? "Category order updated.")
      router.refresh()
    }
  }

  return (
    <Dialog onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetDraft() }} open={open}>
      <DialogTrigger render={<Button type="button" variant="outline" />}><FolderTree aria-hidden="true" />Manage categories</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Product categories</DialogTitle>
          <DialogDescription>Create parent categories and subcategories, then reorder or manage them.</DialogDescription>
        </DialogHeader>

        <section className="grid gap-3 rounded-xl border bg-muted/20 p-4">
          <h3 className="font-medium">{editingId ? "Edit category" : "New category"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">Name<Input maxLength={100} onChange={(event) => setDraftField("name", event.currentTarget.value)} placeholder="e.g. Clothing" value={draft.name} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Parent category<select className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm" onChange={(event) => setDraftField("parentId", event.currentTarget.value)} value={draft.parentId}><option value="">None</option>{orderedCategories.filter((category) => category.id !== editingId && !category.parentId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span><Textarea maxLength={500} onChange={(event) => setDraftField("description", event.currentTarget.value)} value={draft.description} /></label>
          {editingId ? <label className="flex items-center gap-2 text-sm"><input checked={draft.isActive} className="size-4 accent-primary" onChange={(event) => setDraftField("isActive", event.currentTarget.checked)} type="checkbox" />Active category</label> : null}
          <div className="flex justify-end gap-2">
            {editingId ? <Button disabled={pending} onClick={resetDraft} size="sm" type="button" variant="ghost">Cancel edit</Button> : null}
            <Button disabled={pending || draft.name.trim().length < 2} onClick={saveCategory} size="sm" type="button">{pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}{editingId ? "Save category" : "Add category"}</Button>
          </div>
        </section>

        <div className="divide-y rounded-xl border">
          {orderedCategories.length ? orderedCategories.map((category, index) => {
            const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null
            return (
              <div className="flex items-center gap-3 p-3" key={category.id}>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{category.name}</span><span className="block truncate text-xs text-muted-foreground">{parent ? `Subcategory of ${parent.name}` : "Parent category"}{category.isActive ? "" : " · Inactive"}</span></span>
                <Button aria-label={`Move ${category.name} up`} disabled={pending || index === 0} onClick={() => moveCategory(index, -1)} size="icon-sm" type="button" variant="ghost"><ArrowUp aria-hidden="true" /></Button>
                <Button aria-label={`Move ${category.name} down`} disabled={pending || index === orderedCategories.length - 1} onClick={() => moveCategory(index, 1)} size="icon-sm" type="button" variant="ghost"><ArrowDown aria-hidden="true" /></Button>
                <Button aria-label={`Edit ${category.name}`} disabled={pending} onClick={() => edit(category)} size="icon-sm" type="button" variant="ghost"><Pencil aria-hidden="true" /></Button>
                <Button aria-label={`Delete ${category.name}`} disabled={pending} onClick={() => deleteCategory(category)} size="icon-sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button>
              </div>
            )
          }) : <p className="p-6 text-center text-sm text-muted-foreground">No categories yet.</p>}
        </div>
        <DialogFooter><Button onClick={() => setOpen(false)} type="button" variant="outline">Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
