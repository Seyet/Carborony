import { Skeleton } from "@/components/ui/skeleton"

export default function StoreLoading() {
  return <div className="min-h-screen"><Skeleton className="h-16 w-full rounded-none" /><div className="mx-auto max-w-7xl space-y-8 px-4 py-16"><Skeleton className="h-14 w-2/3" /><Skeleton className="h-6 w-1/2" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton className="aspect-[3/4] rounded-2xl" key={index} />)}</div></div></div>
}
