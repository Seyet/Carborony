import { Skeleton } from "@/components/ui/skeleton"

export default function ActivityLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-9 w-56" /><Skeleton className="h-5 w-96 max-w-full" /></div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-3"><Skeleton className="h-5 w-20" /><Skeleton className="h-80 w-full rounded-xl" /></div>
    </div>
  )
}
