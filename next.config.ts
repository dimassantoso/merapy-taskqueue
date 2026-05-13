import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export as fully static HTML/CSS/JS so the kapynis task queue worker
  // can serve the dashboard directly via FastAPI StaticFiles on port 8080.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
