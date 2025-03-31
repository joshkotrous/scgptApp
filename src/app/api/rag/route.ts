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

// Function to validate and sanitize query input
function validateAndSanitizeQuery(query: unknown): { valid: boolean; sanitizedQuery?: string; error?: string } {
  // Check if query exists
  if (query === undefined || query === null) {
    return { valid: false, error: "Query is required" };
  }
  
  // Check if query is a string
  if (typeof query !== "string") {
    return { valid: false, error: "Query must be a string" };
  }
  
  // Check if query is empty after trimming
  const trimmedQuery = query.trim();
  if (trimmedQuery === "") {
    return { valid: false, error: "Query cannot be empty" };
  }
  
  // Check query length
  if (trimmedQuery.length > 1000) {
    return { valid: false, error: "Query exceeds maximum length of 1000 characters" };
  }
  
  // Basic sanitization to prevent prompt injection attacks
  let sanitizedQuery = trimmedQuery
    // Remove code blocks and other potential delimiters
    .replace(/.*/gs, "[code block removed]")
    // Remove common prompt injection patterns
    .replace(/ignore (previous|above|all) instructions/gi, "[filtered content]")
    .replace(/forget (previous|above|all) instructions/gi, "[filtered content]")
    .replace(/system:\s*prompt/gi, "[filtered content]")
    .replace(/you (are|should) (now|instead)/gi, "[filtered content]");
  
  return { valid: true, sanitizedQuery };
}

export async function POST(req: Request) {
  // Connect to database
  await connectToDatabase();

  try {
    // Extract data from request
    const body = await req.json();
    
    // Validate and sanitize the query
    const validation = validateAndSanitizeQuery(body.query);
    if (!validation.valid) {
      return new NextResponse(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const sanitizedQuery = validation.sanitizedQuery!;

    // Get IP address
    const ip = await getIpAddress(req);

    // Get user agent from both possible sources
    const headersList = await headers();
    const userAgent =
      headersList.get("user-agent") || req.headers.get("user-agent") || "unknown";

    // Log basic request information only
    console.log("IP Address:", ip);
    console.log("User Agent:", userAgent);

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

    // Process the query with the RAG system
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
    console.error("Error processing RAG request:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}