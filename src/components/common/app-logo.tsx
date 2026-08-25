import Image from "next/image"

import { cn } from "@/lib/utils"

export function AppLogo({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("shrink-0", className)}
      height={95}
      src="/logo.svg"
      unoptimized
      width={95}
    />
  )
}
