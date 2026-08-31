import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Polaris",
    short_name: "Polaris",
    description: "Your academic north star for evidence-backed planning and daily action.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF6F0",
    theme_color: "#2C1810",
    icons: [
      { src: "/icon.svg", sizes: "32x32", type: "image/svg+xml" },
      { src: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  };
}
