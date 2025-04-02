// app/api/rag/route.ts
import { askRAGStream } from "@/lib/rag";
import { connectToDatabase } from "db";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { RequestLog } from "db/schema";

// Helper function to get the real IP address
async function getIpAddress(req: Request): Promise<string> {
  const headersList = headers();

  // Try different headers that might contain the IP
  // Order matters - prioritize more trusted sources first
  const ipSources = [
    headersList.get("x-real-ip"),
    headersList.get("cf-connecting-ip"), // Cloudflare
    headersList.get("true-client-ip"), // Akamai and Cloudflare
    req.headers.get("x-real-ip"),
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
  ];

  // Use the first non-null value from trusted headers
  for (const ip of ipSources) {
    if (ip && ip.trim()) {
      return ip.trim();
    }
  }

  // Handle x-forwarded-for with more caution as it's more easily spoofed
  const forwardedFor = 
    headersList.get("x-forwarded-for") || 
    req.headers.get("x-forwarded-for");
    
  if (forwardedFor) {
    // Take the first IP which is typically the client IP
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // Fallback to unknown
  return "unknown";
}

// Function to validate and sanitize query input
function validateQuery(query: unknown): string {
  // Check if query exists and is a string
  if (typeof query !== 'string') {
    throw new Error('Query must be a string');
  }
  
  // Check if query is empty
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Query cannot be empty');
  }
  
  // Check query length (adjust limits as needed for your application)
  if (trimmedQuery.length > 1000) {
    throw new Error('Query exceeds maximum length of 1000 characters');
  }
  
  // Basic sanitization - remove control characters
  const sanitizedQuery = trimmedQuery.replace(/[\x00-\x1F\x7F]/g, '');
  
  return sanitizedQuery;
}

export async function POST(req: Request) {
  // Connect to database
  await connectToDatabase();

  try {
    // Extract data from request
    const requestData = await req.json();
    
    // Validate and sanitize the query
    const sanitizedQuery = validateQuery(requestData.query);

    // Get IP address
    const ip = await getIpAddress(req);

    // Get user agent from both possible sources
    const headersList = headers();
    const userAgent =
      headersList.get("user-agent") || req.headers.get("user-agent") || "unknown";

    // Only log minimal non-sensitive information in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Processing query of length ${sanitizedQuery.length}`);
    }

    try {
      // Log the request asynchronously
      RequestLog.create({
        ip,
        query: sanitizedQuery,
        userAgent,
        timestamp: new Date(),
      }).catch((err) => {
        console.error("Error logging request:", err);
      });
    } catch (error) {
      console.error("Error initializing request log:", error);
    }

    // Process the sanitized query with the RAG system
    const stream = await askRAGStream(sanitizedQuery);

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
  } catch (error) {
    // Handle errors, including validation errors
    console.error("Error processing request:", error);
    return new NextResponse(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      }),
      { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}