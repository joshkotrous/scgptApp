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

// Validate an IP address with comprehensive checks
function validateIpAddress(ip: string | null): string | null {
  if (!ip) return null;
  
  // Comprehensive IPv4 validation
  const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Pattern.test(ip)) {
    return ip;
  }
  
  // IPv6 validation with a comprehensive regex
  const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  
  if (ipv6Pattern.test(ip)) {
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