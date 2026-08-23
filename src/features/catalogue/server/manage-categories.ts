import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { CategoryMutationData } from "../api-types"
import type { CategoryMutationInput } from "../schemas"

function categorySlug(name: string, id: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 70).replace(/-$/g, "") || "category"
  return `${base}-${id.replaceAll("-", "").slice(0, 8)}`
}

export async function manageCategory(
  input: CategoryMutationInput,
): Promise<JsonHandlerResult<CategoryMutationData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage categories.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()

  if (input.action === "create") {
    if (input.parentId) {
      const parent = await supabase.from("categories").select("id")
        .eq("business_id", business.id).eq("id", input.parentId).eq("is_active", true)
        .maybeSingle()
      if (parent.error || !parent.data) {
        throw new ApiError(422, "CATEGORY_PARENT_INVALID", "Select a valid parent category.")
      }
    }

    const id = crypto.randomUUID()
    const positionResult = await supabase.from("categories").select("position")
      .eq("business_id", business.id).order("position", { ascending: false }).limit(1)
      .maybeSingle()
    if (positionResult.error) {
      throw new ApiError(503, "CATEGORY_SAVE_FAILED", "We couldn't create this category.")
    }

    const { error } = await supabase.from("categories").insert({
      business_id: business.id,
      created_by: user.id,
      description: input.description,
      id,
      name: input.name,
      parent_id: input.parentId,
      position: (positionResult.data?.position ?? -1) + 1,
      slug: categorySlug(input.name, id),
    })

    if (error) {
      if (error.code === "23505") {
        throw new ApiError(409, "CATEGORY_EXISTS", "A category with this name already exists.")
      }
      throw new ApiError(503, "CATEGORY_SAVE_FAILED", "We couldn't create this category.")
    }
    return { data: { categoryId: id }, message: "Category created.", status: 201 }
  }

  if (input.action === "update") {
    const categoriesResult = await supabase.from("categories").select("id, parent_id")
      .eq("business_id", business.id)
    if (categoriesResult.error) {
      throw new ApiError(503, "CATEGORY_SAVE_FAILED", "We couldn't update this category.")
    }

    const categories = categoriesResult.data ?? []
    if (!categories.some((category) => category.id === input.categoryId)) {
      throw new ApiError(404, "CATEGORY_NOT_FOUND", "This category could not be found.")
    }
    if (input.parentId) {
      const parents = new Map(categories.map((category) => [category.id, category.parent_id]))
      let ancestorId: string | null = input.parentId
      while (ancestorId) {
        if (ancestorId === input.categoryId) {
          throw new ApiError(422, "CATEGORY_CYCLE", "A category cannot be nested inside itself.")
        }
        ancestorId = parents.get(ancestorId) ?? null
      }
    }

    const { error } = await supabase.from("categories").update({
      description: input.description,
      is_active: input.isActive,
      name: input.name,
      parent_id: input.parentId,
      slug: categorySlug(input.name, input.categoryId),
    }).eq("business_id", business.id).eq("id", input.categoryId)

    if (error) {
      throw new ApiError(503, "CATEGORY_SAVE_FAILED", "We couldn't update this category.")
    }
    return { data: { categoryId: input.categoryId }, message: "Category updated." }
  }

  if (input.action === "delete") {
    const { error } = await supabase.from("categories").delete()
      .eq("business_id", business.id).eq("id", input.categoryId)

    if (error) {
      if (error.code === "23503") {
        throw new ApiError(
          409,
          "CATEGORY_IN_USE",
          "Move its products and subcategories before deleting this category.",
        )
      }
      throw new ApiError(503, "CATEGORY_DELETE_FAILED", "We couldn't delete this category.")
    }
    return { data: { categoryId: input.categoryId }, message: "Category deleted." }
  }

  const reorderResult = await supabase.rpc("reorder_catalogue_categories", {
    ordered_category_ids: input.orderedIds,
    target_business_id: business.id,
  })
  if (reorderResult.error) {
    if (reorderResult.error.message === "The category order is invalid.") {
      throw new ApiError(422, "CATEGORY_ORDER_INVALID", reorderResult.error.message)
    }
    throw new ApiError(503, "CATEGORY_ORDER_FAILED", "We couldn't reorder the categories.")
  }

  return { data: {}, message: "Category order updated." }
}
