import { OpenAI } from "openai";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure this is set in your environment
});

/**
 * Embeds a query string using OpenAI's embedding model
 *
 * @param query The text to embed
 * @returns A vector representation (embedding) of the query
 */
export async function embedQuery(query: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    // Log that an error occurred without exposing sensitive details
    console.error("Error generating embedding");
    
    // In non-production environments, log the error message for debugging
    if (process.env.NODE_ENV !== "production") {
      console.error("Error details:", error instanceof Error ? error.message : "unknown error");
    }
    
    // Throw a generic error message to avoid leaking sensitive information
    throw new Error("Failed to generate embedding");
  }
}