// app/page.tsx or app/page.js (depending on your setup)
import { headers } from "next/headers";
import { connectToDatabase } from "db";
import ChatClient from "./chatClient";
import { RequestLog } from "db/schema";

export interface IPStats {
  ip: string;
  totalRequests: number;
  recentRequests: number;
}

// Validate an IP address with basic checks
function validateIpAddress(ip: string | null): string | null {
  if (!ip) return null;
  
  // Simple IPv4 validation
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const octets = ip.split('.');
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return null;
      }
    }
    return ip;
  }
  
  // Simplified IPv6 validation - just checks basic format
  if (ip.includes(':')) {
    // Check for invalid characters
    if (/[^0-9a-fA-F:]/.test(ip)) {
      return null;
    }
    return ip;
  }
  
  return null;
}

async function getIpStats(): Promise<IPStats> {
  await connectToDatabase();

  // Get the client's IP address with validation
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  let candidateIp = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const validatedIp = validateIpAddress(candidateIp);
  const ip = validatedIp || "unknown";

  // Count total requests from this IP
  const totalRequests = await RequestLog.countDocuments({ ip });

  // Count requests in the last 24 hours
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);
  const recentRequests = await RequestLog.countDocuments({
    ip,
    timestamp: { $gte: last24Hours },
  });

  return {
    ip,
    totalRequests,
    recentRequests,
  };
}

export default async function Home() {
  const ipStats = await getIpStats();
  return (
    <div className="size-full max-w-5xl container mx-auto">
      <ChatClient ipStats={ipStats} />

      <div className="text-xs text-gray-500 mt-2 text-right">
        IP: {ipStats.ip} | Requests: {ipStats.totalRequests} (Last 24h:{" "}
        {ipStats.recentRequests})
      </div>
    </div>
  );
}