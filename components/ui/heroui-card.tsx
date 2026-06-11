"use client";

// Bento card - adapted from the HeroUI card. Retinted to Aether matte (dark
// gradient, white text, 20px radius to match the popups). Compound API kept.

import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "transparent" | "default" | "secondary" | "tertiary";

const variantClasses: Record<CardVariant, string> = {
  transparent: "border-none bg-transparent shadow-none",
  default: "gx gx-bento",
  secondary: "border border-white/[.06] bg-white/[.03]",
  tertiary: "border border-white/[.08] bg-white/[.06]",
};

type CardRootProps = React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant };

function CardRoot({ children, className, variant = "default", ...props }: CardRootProps) {
  return (
    <div className={cn("relative flex flex-col gap-3 overflow-hidden rounded-[20px] p-4 text-white", variantClasses[variant], className)} data-slot="card" {...props}>
      {children}
    </div>
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col", className)} data-slot="card-header" {...props} />;
}
function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-medium leading-6 text-white", className)} data-slot="card-title" {...props} />;
}
function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-5 text-white/45", className)} data-slot="card-description" {...props} />;
}
function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-1 flex-col gap-1 text-sm", className)} data-slot="card-content" {...props} />;
}
function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-row items-center", className)} data-slot="card-footer" {...props} />;
}

const Card = Object.assign(CardRoot, {
  Header: CardHeader, Title: CardTitle, Description: CardDescription, Content: CardContent, Footer: CardFooter,
});

export { Card, CardRoot, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export type { CardRootProps, CardVariant };
