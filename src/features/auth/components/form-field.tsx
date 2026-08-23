"use client"

import { Eye, EyeOff } from "lucide-react"
import {
  type ComponentProps,
  type ChangeEventHandler,
  type FocusEventHandler,
  type ReactNode,
  useState,
} from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FormFieldProps = {
  autoCapitalize?: ComponentProps<"input">["autoCapitalize"]
  autoComplete: string
  autoFocus?: boolean
  errorMessage?: string
  hint?: string
  inputClassName?: string
  inputMode?: ComponentProps<"input">["inputMode"]
  invalid?: boolean
  label: string
  labelAccessory?: ReactNode
  maxLength?: number
  minLength?: number
  name: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onChange?: ChangeEventHandler<HTMLInputElement>
  pattern?: string
  placeholder?: string
  required?: boolean
  type?: "email" | "password" | "tel" | "text"
  value?: string
}

export function FormField({
  autoCapitalize,
  autoComplete,
  autoFocus,
  errorMessage,
  hint,
  inputClassName,
  inputMode,
  invalid = false,
  label,
  labelAccessory,
  maxLength,
  minLength,
  name,
  onBlur,
  onChange,
  pattern,
  placeholder,
  required = true,
  type = "text",
  value,
}: FormFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const isPassword = type === "password"
  const errorId = `${name}-error`
  const hintId = `${name}-hint`
  const describedBy =
    [errorMessage ? errorId : undefined, hint ? hintId : undefined]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-medium" htmlFor={name}>
          {label}
        </label>
        {labelAccessory}
      </div>
      <div className="relative">
        <Input
          aria-describedby={describedBy}
          aria-errormessage={errorMessage ? errorId : undefined}
          aria-invalid={invalid || undefined}
          autoCapitalize={
            autoCapitalize ?? (type === "text" ? "words" : "none")
          }
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={cn(
            "h-11 px-3",
            isPassword && "pr-11",
            inputClassName,
          )}
          id={name}
          inputMode={inputMode}
          maxLength={maxLength}
          minLength={minLength}
          name={name}
          onBlur={onBlur}
          onChange={onChange}
          pattern={pattern}
          placeholder={placeholder}
          required={required}
          spellCheck={type === "email" || type === "tel" ? false : undefined}
          type={isPassword && passwordVisible ? "text" : type}
          value={value}
        />
        {isPassword ? (
          <button
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-pressed={passwordVisible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        ) : null}
      </div>
      {errorMessage ? (
        <p
          aria-atomic="true"
          aria-live="polite"
          className="text-xs leading-5 text-destructive"
          id={errorId}
        >
          {errorMessage}
        </p>
      ) : null}
      {hint ? (
        <p className="text-xs leading-5 text-muted-foreground" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
