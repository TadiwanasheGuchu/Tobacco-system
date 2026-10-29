import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tobacco Floor System",
  description: "Bale reception, grading, sales and grower settlement for tobacco floors.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
