import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import Logo from "./logo";
import { Analytics } from "@vercel/analytics/react";
import BuyMeCoffeeButton from "./buyMeACoffee";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-quantico",
});

export const metadata: Metadata = {
  title: "scGPT",
  description: "scGPT | Your Personal Assistant in the Verse",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function DelayedContent({ children }: { children: React.ReactNode }) {
  await delay(3000); // Simulate loading for 3 seconds
  return <>{children}</>;
}
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={orbitron.variable}>
      <body
        className={`antialiased ${orbitron.className} w-screen h-screen overflow-hidden bg-background`}
      >
        <Suspense
          fallback={
            <div className="size-full flex justify-center items-center animate-pulse">
              <Logo />
            </div>
          }
        >
          <nav className="p-4 flex justify-between items-center">
            <Logo className="text-2xl" />
            <BuyMeCoffeeButton
              target="_blank"
              href="https://buymeacoffee.com/joshkotrous"
              className=" text-xs p-2 "
            />
          </nav>

          <Analytics />
          {children}
        </Suspense>
      </body>
    </html>
  );
}
