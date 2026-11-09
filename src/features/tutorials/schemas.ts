import { z } from "zod"
import { tutorialModuleIds } from "./guides"

export const tutorialProgressSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("finish"), moduleId: z.enum(tutorialModuleIds), status: z.enum(["completed", "skipped"]) }),
  z.object({ action: z.literal("disable") }),
])
export type TutorialProgressInput = z.output<typeof tutorialProgressSchema>
