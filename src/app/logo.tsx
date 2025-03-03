import { cn } from "../lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <h1 className={cn(`text-5xl font-bold text-foreground`, className)}>
      scGPT
    </h1>
  );
}
