import { Skeleton } from "@/components/ui/skeleton"

export default function AuthLoading() {
  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl shadow-foreground/5">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-3 h-4 w-full" />
      <div className="mt-8 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  )
}
