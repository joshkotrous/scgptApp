// app/api/rag/route.ts
import { askRAGStream } from "@/lib/rag";
import { connectToDatabase } from "db";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { RequestLog } from "db/schema";

// Helper function to get the real IP address
async function getIpAddress(req: Request): Promise<string> {
  const headersList = await headers();

  // Try different headers that might contain the IP
  // Order matters - most reliable sources first
  const ipSources = [
    headersList.get("x-real-ip"),
    headersList.get("x-forwarded-for"),
    headersList.get("cf-connecting-ip"), // Cloudflare
    headersList.get("true-client-ip"), // Akamai and Cloudflare
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for"),
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
  ];

  // Use the first non-null value
  for (const ip of ipSources) {
    if (ip) {
      // If it's a comma-separated list, take the first one
      return ip.split(",")[0].trim();
    }
  }

  // Fallback to unknown
  return "unknown";
}

export async function POST(req: Request) {
  // Connect to database
  await connectToDatabase();

  // Extract data from request
  const { query } = await req.json();

  // Get IP address
  const ip = await getIpAddress(req);

  // Get user agent from both possible sources
  const headersList = await headers();
  const userAgent =
    headersList.get("user-agent") || req.headers.get("user-agent") || "unknown";

  // Log the request and headers for debugging
  console.log("IP Address:", ip);
  console.log("User Agent:", userAgent);

  // Log all headers to debug
  console.log("Request Headers:");
  req.headers.forEach((value, key) => {
    console.log(`${key}: ${value}`);
  });

  // Log Next.js headers
  console.log("Next.js Headers:");
  for (const [key, value] of headersList.entries()) {
    console.log(`${key}: ${value}`);
  }

  try {
    // Log the request asynchronously
    RequestLog.create({
      ip,
      query,
      userAgent,
      timestamp: new Date(),
    }).catch((err) => {
      console.error("Error logging request:", err);
    });
  } catch (error) {
    console.error("Error initializing request log:", error);
  }

  // Process the query with the RAG system
  const stream = await askRAGStream(query);

  // Return streaming response
  return new NextResponse(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          controller.enqueue(new TextEncoder().encode(content));
        }
        controller.close();
      },
    }),
    {
      headers: { "Content-Type": "text/plain" },
    }
  );
}
