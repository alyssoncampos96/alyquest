import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlyQuest",
    short_name: "AlyQuest",
    description: "Seu RPG pessoal de produtividade.",
    start_url: "/",
    display: "standalone",
    background_color: "#080a13",
    theme_color: "#080a13",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
