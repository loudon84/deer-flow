/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

function getInternalServiceURL(envKey, fallbackURL) {
  const configured = process.env[envKey]?.trim();
  return configured && configured.length > 0
    ? configured.replace(/\/+$/, "")
    : fallbackURL;
}

// For local development without Nginx
const LOCAL_LANGGRAPH_URL = "http://192.168.70.166:2024";
const LOCAL_GATEWAY_URL = "http://192.168.70.166:8001";
const LOCAL_STUDIO_URL = "http://localhost:8320";


/** @type {import("next").NextConfig} */
const config = {
  devIndicators: false,
  async rewrites() {
    const rewrites = [];
    
    // Use environment variables if set, otherwise use local development URLs
    const langgraphURL = getInternalServiceURL(
      "DEER_FLOW_INTERNAL_LANGGRAPH_BASE_URL",
      LOCAL_LANGGRAPH_URL,
    );
    const gatewayURL = getInternalServiceURL(
      "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL",
      LOCAL_GATEWAY_URL,
    );
    const studioURL = getInternalServiceURL(
      "DEER_FLOW_INTERNAL_STUDIO_BASE_URL",
      LOCAL_STUDIO_URL,
    );

    // LangGraph API proxy
    if (!process.env.NEXT_PUBLIC_LANGGRAPH_BASE_URL) {
      rewrites.push({
        source: "/api/langgraph",
        destination: langgraphURL,
      });
      rewrites.push({
        source: "/api/langgraph/:path*",
        destination: `${langgraphURL}/:path*`,
      });
    }

    // Gateway API proxy (models, agents, etc.)
    if (!process.env.NEXT_PUBLIC_BACKEND_BASE_URL) {
      rewrites.push({
        source: "/api/models",
        destination: `${gatewayURL}/api/models`,
      });
      rewrites.push({
        source: "/api/agents",
        destination: `${gatewayURL}/api/agents`,
      });
      rewrites.push({
        source: "/api/agents/:path*",
        destination: `${gatewayURL}/api/agents/:path*`,
      });
      
      // Studio API proxy (runs on port 8320)
      rewrites.push({
        source: "/api/v1",
        destination: `${studioURL}/api/v1`,
      });
      rewrites.push({
        source: "/api/v1/:path*",
        destination: `${studioURL}/api/v1/:path*`,
      });
    }

    return rewrites;
  },
};

export default config;
