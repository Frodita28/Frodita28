import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app es mayormente privada y dinámica (sesión por cookies), así que
  // usamos el modelo de renderizado dinámico clásico en lugar de Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
