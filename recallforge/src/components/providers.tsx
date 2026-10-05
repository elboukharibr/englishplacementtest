"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { UpsellDialog } from "@/components/app/upsell-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <UpsellDialog />
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
