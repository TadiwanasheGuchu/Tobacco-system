import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tobacco Floor",
    short_name: "Floor",
    description: "Scan, grade, bid and record grower decisions on the tobacco floor.",
    // Handhelds open straight onto the scan screen.
    start_url: "/floor",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf5ec",
    theme_color: "#3a2416",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
