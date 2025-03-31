import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";
import { embedQuery } from "./embed";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
const INDEX_NAME = "scgpt-oai-small";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.index(INDEX_NAME);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Function to sanitize input strings to prevent injection attacks
function sanitizeInput(input: string): string {
  // Remove potential injection patterns or control characters
  let sanitized = input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .trim();
    
  // Limit length to prevent excessive resource usage
  const MAX_LENGTH = 2000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + "...";
  }
  
  return sanitized;
}

// Function to validate and sanitize context array
function validateContext(context: string[]): string[] {
  // Filter out empty strings, apply sanitization, and limit the number of contexts
  const MAX_CONTEXTS = 50;
  return context
    .filter(item => item && item.trim() !== '')
    .map(item => sanitizeInput(item))
    .slice(0, MAX_CONTEXTS);
}

async function searchPinecone(queryEmbedding: number[], topK = 5) {
  console.log(`Searching Pinecone for similar embeddings (top ${topK})...`);
  const results = await index.query({
    vector: queryEmbedding,
    topK: topK,
    includeMetadata: true,
  });

  return results.matches
    .map((match) => match.metadata?.text)
    .filter(Boolean) as string[];
}

async function generateResponse(query: string, context: string[]) {
  const sanitizedQuery = sanitizeInput(query);
  const validatedContext = validateContext(context);
  
  console.log("Using context: ", validatedContext.join("\n\n"));
  console.log("Generating final response with LLM...");
  
  const systemPrompt = `You are a chat assistant roleplaying as an AI chat assistant within the game Star Citizen to answer questions from users. This can range from general queries, to finding out where to buy commodities, the best place to buy commodities, and so much more. All currencies are in aUEC format (alpha united earth credits). Use the following context to answer user queries.\n\nContext:\n${validatedContext.join(
    "\n\n"
  )}`;

  // Adding safeguards in the system prompt
  const safetyInstructions = `\n\nImportant guidelines:
  - Only provide information relevant to Star Citizen game
  - Stick to the facts provided in the context
  - If you're unsure, express uncertainty rather than making up information
  - Do not generate harmful, misleading, or inappropriate content`;

  const enhancedSystemPrompt = systemPrompt + safetyInstructions;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: enhancedSystemPrompt },
      { role: "user", content: sanitizedQuery },
    ],
  });

  return completion.choices[0].message.content;
}

async function askRAG(query: string) {
  console.log("Embedding query...");
  const sanitizedQuery = sanitizeInput(query);
  const queryEmbedding = await embedQuery(sanitizedQuery);

  console.log("Searching Pinecone...");
  const retrievedContext = await searchPinecone(queryEmbedding, 50);

  if (retrievedContext.length === 0) {
    console.log(
      "No relevant context found. Falling back to general knowledge."
    );
    return await generateResponse(sanitizedQuery, []);
  }

  return await generateResponse(sanitizedQuery, retrievedContext);
}

async function generateResponseStream(query: string, context: string[]) {
  console.log("Generating final response with LLM (Streaming)...");

  const sanitizedQuery = sanitizeInput(query);
  const validatedContext = validateContext(context);

  const systemPrompt = `You are a chat assistant roleplaying as an AI chat assistant within the game Star Citizen to answer questions from users. This can range from general queries, to finding out where to buy commodities, the best place to buy commodities, and so much more. All currencies are in aUEC format (alpha united earth credits). Use the following context to answer user queries.\n\nContext:\n${validatedContext.join(
    "\n\n"
  )}
  
  Output your response in markdown for proper formatting in the chat ui including proper headings.`;

  // Adding safeguards in the system prompt
  const safetyInstructions = `\n\nImportant guidelines:
  - Only provide information relevant to Star Citizen game
  - Stick to the facts provided in the context
  - If you're unsure, express uncertainty rather than making up information
  - Do not generate harmful, misleading, or inappropriate content`;

  const enhancedSystemPrompt = systemPrompt + safetyInstructions;

  const stream = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: enhancedSystemPrompt },
      { role: "user", content: sanitizedQuery },
    ],
    stream: true,
  });
  return stream;
}

export async function askRAGStream(query: string) {
  console.log("Embedding query...");
  const sanitizedQuery = sanitizeInput(query);
  const queryEmbedding = await embedQuery(sanitizedQuery);

  console.log("Searching Pinecone...");
  const retrievedContext = await searchPinecone(queryEmbedding, 50);

  if (retrievedContext.length === 0) {
    console.log(
      "No relevant context found. Falling back to general knowledge."
    );
    return await generateResponseStream(sanitizedQuery, []);
  }

  return await generateResponseStream(sanitizedQuery, retrievedContext);
}