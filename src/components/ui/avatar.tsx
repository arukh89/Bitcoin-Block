import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Avatar({ className, ...props }: AvatarProps): JSX.Element {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-800 text-white items-center justify-center",
        className
      )}
      {...props}
    />
  )
}

export function AvatarImage({ className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>): JSX.Element {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cn("h-full w-full object-cover", className)}
      alt={props.alt || "avatar"}
      {...props}
    />
  )
}

export function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gray-700 text-sm font-medium",
        className
      )}
      {...props}
    />
  )
}
