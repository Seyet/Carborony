import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

type SubmitButtonProps = {
  children: React.ReactNode
  disabled?: boolean
  pending: boolean
}

export function SubmitButton({
  children,
  disabled = false,
  pending,
}: SubmitButtonProps) {
  return (
    <Button
      className="h-11 w-full"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          Please wait
        </>
      ) : (
        children
      )}
    </Button>
  )
}
