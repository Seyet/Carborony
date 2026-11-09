"use client"

import { usePathname } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { postJson } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { getModuleGuide, type ModuleGuide, type TutorialProgress } from "./guides"
import type { TutorialProgressInput } from "./schemas"

type GuideProps = {
  guide: ModuleGuide
  automatic: boolean
  onFinish: (status: "completed" | "skipped") => void
  onDisable: () => void
}

function PageGuide({ guide, automatic, onFinish, onDisable }: GuideProps) {
  const [open,setOpen] = useState(automatic)
  const [stepIndex,setStepIndex] = useState(0)
  const step = guide.steps[stepIndex]
  const lastStep = stepIndex === guide.steps.length-1

  function finish(status: "completed" | "skipped") {
    setOpen(false)
    onFinish(status)
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={()=>{setStepIndex(0);setOpen(true)}}>
          <BookOpen aria-hidden="true" className="size-4" />Page guide
        </Button>
      </div>
      <Dialog open={open} onOpenChange={next=>{if (!next) finish("skipped")}}>
        <DialogContent className="max-h-[85svh] overflow-y-auto p-0 sm:max-w-lg" showCloseButton>
          <DialogHeader className="border-b bg-muted/30 p-6 pr-12">
            <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles aria-hidden="true" className="size-5" /></span>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">A quick guide to Noddar</p>
            <DialogTitle className="text-xl">{guide.title}</DialogTitle>
            <DialogDescription>Take a quick look around. You can skip this guide and reopen it anytime.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 pb-2" aria-live="polite" aria-atomic="true">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Step {stepIndex+1} of {guide.steps.length}</span>
              <div aria-hidden="true" className="flex flex-1 gap-1.5">
                {guide.steps.map((item,index)=><span key={item.title} className={cn("h-1 flex-1 rounded-full",index<=stepIndex?"bg-primary":"bg-muted")} />)}
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="text-sm leading-7 text-muted-foreground">{step.description}</p>
            </div>
            <div className="flex gap-3 rounded-xl border bg-muted/30 p-4 text-sm leading-6">
              <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>{step.tip}</p>
            </div>
          </div>
          <div className="space-y-4 border-t px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={()=>finish("skipped")}>Skip guide</Button>
              <div className="flex gap-2">
                {stepIndex>0 ? <Button type="button" variant="outline" size="sm" onClick={()=>setStepIndex(index=>index-1)}><ArrowLeft aria-hidden="true" className="size-4" />Back</Button> : null}
                <Button type="button" size="sm" onClick={()=>lastStep?finish("completed"):setStepIndex(index=>index+1)}>
                  {lastStep?"Got it":"Next"}{!lastStep?<ArrowRight aria-hidden="true" className="size-4" />:null}
                </Button>
              </div>
            </div>
            <button type="button" className="w-full rounded text-center text-xs text-muted-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={()=>{setOpen(false);onDisable()}}>Don&apos;t show guides automatically</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ModuleTutorial({ progress: initialProgress, permissions }: { progress: TutorialProgress; permissions: string[] }) {
  const pathname = usePathname()
  const [progress,setProgress] = useState(initialProgress)
  const guide = getModuleGuide(pathname,permissions)

  async function persist(input: TutorialProgressInput) {
    const response = await postJson<{ saved: true }>("/api/tutorials/progress",input,{loading:false})
    if (!response.ok) toast.error(response.error.message)
  }

  if (!guide) return null
  return <PageGuide key={guide.id} guide={guide}
    automatic={progress.automatic&&!progress.handledModules.includes(guide.id)}
    onFinish={status=>{
      setProgress(current=>({...current,handledModules:[...new Set([...current.handledModules,guide.id])]}))
      void persist({action:"finish",moduleId:guide.id,status})
    }}
    onDisable={()=>{
      setProgress(current=>({...current,automatic:false}))
      void persist({action:"disable"})
    }}
  />
}
