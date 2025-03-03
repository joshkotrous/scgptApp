import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["../packages/scgpt"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("onnxruntime-node");
    }
    return config;
  },
};

export default nextConfig;
