import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import { RegisterServiceWorker } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tobacco Floor System",
  description: "Bale reception, grading, sales and grower settlement for tobacco floors.",
  appleWebApp: { capable: true, title: "Tobacco Floor", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3a2416" },
    { media: "(prefers-color-scheme: dark)", color: "#120d09" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
