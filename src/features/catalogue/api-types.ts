export type SaveProductData = {
  productId: string
  redirectTo: string
}

export type CategoryMutationData = {
  categoryId?: string
}

export type MediaUploadData = {
  uploads: Array<{
    path: string
    token: string
  }>
}

export type MediaMutationData = {
  mediaId?: string
  mediaIds?: string[]
}
