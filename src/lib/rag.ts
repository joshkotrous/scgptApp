import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";
import { embedQuery } from "./embed";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
const INDEX_NAME = "scgpt-oai-small";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.index(INDEX_NAME);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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
  console.log("Using context: ", context.join("\n\n"));
  console.log("Generating final response with LLM...");
  const systemPrompt = `You are a chat assistant roleplaying as an AI chat assistant within the game Star Citizen to answer questions from users. This can range from general queries, to finding out where to buy commodities, the best place to buy commodities, and so much more. All currencies are in aUEC format (alpha united earth credits). Use the following context to answer user queries.\n\nContext:\n${context.join(
    "\n\n"
  )}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
  });

  return completion.choices[0].message.content;
}

async function askRAG(query: string) {
  console.log("Embedding query...");
  const queryEmbedding = await embedQuery(query);

  console.log("Searching Pinecone...");
  const retrievedContext = await searchPinecone(queryEmbedding, 50);

  if (retrievedContext.length === 0) {
    console.log(
      "No relevant context found. Falling back to general knowledge."
    );
    return await generateResponse(query, []);
  }

  return await generateResponse(query, retrievedContext);
}

async function generateResponseStream(query: string, context: string[]) {
  console.log("Generating final response with LLM (Streaming)...");

  const systemPrompt = `You are a chat assistant roleplaying as an AI chat assistant within the game Star Citizen to answer questions from users. This can range from general queries, to finding out where to buy commodities, the best place to buy commodities, and so much more. All currencies are in aUEC format (alpha united earth credits). Use the following context to answer user queries.\n\nContext:\n${context.join(
    "\n\n"
  )}
  
  Output your response in markdown for proper formatting in the chat ui including proper headings. 
  `;

  const stream = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    stream: true,
  });
  return stream;
}

export async function askRAGStream(query: string) {
  console.log("Embedding query...");
  const queryEmbedding = await embedQuery(query);

  console.log("Searching Pinecone...");
  const retrievedContext = await searchPinecone(queryEmbedding, 50);

  if (retrievedContext.length === 0) {
    console.log(
      "No relevant context found. Falling back to general knowledge."
    );
    return await generateResponseStream(query, []);
  }

  return await generateResponseStream(query, retrievedContext);
}
