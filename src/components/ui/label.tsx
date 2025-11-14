import * as React from "react"
import { cn } from "@/lib/utils"

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps): JSX.Element {
  return (
    <label
      className={cn("text-sm font-medium text-gray-200", className)}
      {...props}
    />
  )
}
