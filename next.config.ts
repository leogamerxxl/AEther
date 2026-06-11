import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: [
    "deck.gl",
    "@deck.gl/core",
    "@deck.gl/layers",
    "@deck.gl/react",
    "@deck.gl/mapbox",
    "@luma.gl/core",
    "@luma.gl/engine",
    "@luma.gl/shadertools",
    "@math.gl/core",
    "maplibre-gl",
  ],
};

export default nextConfig;
