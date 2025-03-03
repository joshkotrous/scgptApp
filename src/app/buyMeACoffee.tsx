"use client";

import { useState } from "react";
import { Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuyMeCoffeeButtonProps {
  href: string;
  className?: string;
  target?: string;
  rel?: string;
}

export default function BuyMeCoffeeButton({
  href = "#",
  className,
  target = "_blank",
  rel = "noopener noreferrer",
}: BuyMeCoffeeButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={href}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-700 to-amber-900 px-6 py-3 text-white shadow-lg transition-all duration-300 hover:shadow-xl",
        isHovered ? "scale-105" : "scale-100",
        className
      )}
      target={target}
      rel={rel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        <Coffee className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
        {/* Steam animation */}
        <div
          className={cn(
            "absolute -top-4 left-1/2 h-3 w-1 -translate-x-1/2 rounded-full bg-white opacity-0 blur-sm transition-all duration-700",
            isHovered ? "animate-steam opacity-70" : ""
          )}
        />
        <div
          className={cn(
            "absolute -top-5 left-1/3 h-3 w-1 -translate-x-1/2 rounded-full bg-white opacity-0 blur-sm transition-all duration-700 delay-100",
            isHovered ? "animate-steam opacity-70" : ""
          )}
        />
        <div
          className={cn(
            "absolute -top-4 left-2/3 h-3 w-1 -translate-x-1/2 rounded-full bg-white opacity-0 blur-sm transition-all duration-700 delay-200",
            isHovered ? "animate-steam opacity-70" : ""
          )}
        />
      </div>
      <span className="font-medium">Buy me a coffee</span>
    </a>
  );
}
