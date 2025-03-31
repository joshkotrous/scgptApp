"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import ReactMarkdown, { Components } from "react-markdown";
import Logo from "./logo";
import { useRouter } from "next/navigation";
import { IPStats } from "./page";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatClient({ ipStats }: { ipStats: IPStats }) {
  const limitExceeded = ipStats.recentRequests > 5;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to validate and sanitize user input
  function validateAndSanitizeInput(input: string): { isValid: boolean; sanitizedInput: string; errorMessage?: string } {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return { isValid: false, sanitizedInput: "", errorMessage: "Input cannot be empty." };
    }
    
    // Check for maximum length to prevent payload abuse
    const MAX_INPUT_LENGTH = 5000;
    if (trimmed.length > MAX_INPUT_LENGTH) {
      return { 
        isValid: false, 
        sanitizedInput: "", 
        errorMessage: `Input exceeds maximum allowed length of ${MAX_INPUT_LENGTH} characters.` 
      };
    }
    
    // Basic sanitization to prevent prompt injection and other common attacks
    const sanitized = trimmed
      // Remove or escape potential script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Prevent common prompt injection patterns
      .replace(/^\/(system|admin|debug)\s/i, 'blocked-command:')
      .replace(/\[\[\s*prompt\s*\]\]/gi, '[blocked-prompt-injection]');
      
    return { isValid: true, sanitizedInput: sanitized };
  }

  async function handleSendMessage() {
    if (!input.trim()) return;

    // Validate and sanitize input before processing
    const { isValid, sanitizedInput, errorMessage } = validateAndSanitizeInput(input);
    
    if (!isValid) {
      // Display error message to user
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: errorMessage || "Invalid input. Please try again." }
      ]);
      setInput("");
      return;
    }

    const newUserMessage: Message = { role: "user", content: sanitizedInput };
    setMessages((prev) => [...prev, newUserMessage]); // Add user message to chat
    setInput("");
    setIsLoading(true);
    setIsStreaming(false); // Reset streaming state

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        body: JSON.stringify({ query: sanitizedInput }),
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`Server responded with status: ${res.status}`);
      }

      if (!res.body) {
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let result = "";

      const newAssistantMessage: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, newAssistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        result += chunk;

        // Set streaming to true after receiving the first chunk
        if (!isStreaming) {
          setIsStreaming(true);
        }

        setMessages((prev) => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1].content = result;
          return [...updatedMessages];
        });
      }
    } catch (error) {
      // Handle errors during API call
      setMessages((prev) => [
        ...prev, 
        { 
          role: "assistant", 
          content: "Sorry, there was an error processing your request. Please try again later." 
        }
      ]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      router.refresh();
    }
  }
  
  // Handle Enter key to send message
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (messages.length === 0) {
    return (
      <div className="relative size-full flex items-center justify-center flex-col gap-12 select-none px-4">
        <div className="text-center space-y-2">
          <Logo className="text-6xl" />
          <h3 className="text-xl text-zinc-500">
            Here to help you with anything in the 'verse
          </h3>
        </div>
        {!limitExceeded ? (
          <div className="bg-zinc-900 rounded-md flex gap-4 p-2 items-end w-full">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-none outline-none max-h-96 flex-grow"
              placeholder="Ask something..."
              disabled={isLoading || limitExceeded}
            />
            <Button
              onClick={handleSendMessage}
              className="h-full max-h-16 bg-orange-500 text-black hover:bg-orange-500/50 transition-all disabled:opacity-50"
              disabled={isLoading || !input.trim() || limitExceeded}
            >
              {isLoading ? (
                <Loader2 className="animate-spin size-6" />
              ) : (
                <ArrowUp className="size-6" />
              )}
            </Button>
          </div>
        ) : (
          "Limit exceeded. Currently you may only ask 5 questions per day"
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-between pb-24 space-y-4 px-4">
      <div
        ref={messagesContainerRef}
        className="space-y-4 overflow-auto px-2 py-4"
      >
        {messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}
        {isLoading && !isStreaming && (
          <Loader2 className="size-6 animate-spin text-zinc-500" />
        )}
      </div>
      <div className="bg-zinc-900 rounded-md flex gap-4 p-2 items-end relative">
        {limitExceeded && (
          <div className="absolute size-full bg-black/75 top-0 left-0 rounded-md z-40 flex justify-center items-center">
            Limit Exceeded. You are currently only allowed 5 messages per day.
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-none outline-none max-h-96 flex-grow"
          placeholder="Ask something..."
          disabled={isLoading || limitExceeded}
        />
        <Button
          onClick={handleSendMessage}
          className="h-full max-h-16 bg-orange-500 text-black hover:bg-orange-500/50 transition-all disabled:opacity-50"
          disabled={isLoading || !input.trim() || limitExceeded}
        >
          {isLoading ? (
            <Loader2 className="animate-spin size-6" />
          ) : (
            <ArrowUp className="size-6" />
          )}
        </Button>
      </div>
    </div>
  );
}

function Message({ message }: { message: Message }) {
  const components: Components = {
    h1: ({ node, ...props }) => (
      <h1 className="text-2xl font-bold my-4" {...props} />
    ),
    h2: ({ node, ...props }) => (
      <h2 className="text-xl font-bold my-3" {...props} />
    ),
    h3: ({ node, ...props }) => (
      <h3 className="text-lg font-bold my-2" {...props} />
    ),

    p: ({ node, ...props }) => <p className="my-2" {...props} />,

    a: ({ node, href, ...props }) => (
      <a className="text-orange-400 hover:underline" href={href} {...props} />
    ),

    ul: ({ node, ...props }) => (
      <ul className="list-disc pl-5 my-2" {...props} />
    ),
    ol: ({ node, ...props }) => (
      <ol className="list-decimal pl-5 my-2" {...props} />
    ),
    li: ({ node, ...props }) => <li className="my-1" {...props} />,

    blockquote: ({ node, ...props }) => (
      <blockquote
        className="border-l-4 border-orange-400 pl-4 italic my-2"
        {...props}
      />
    ),

    hr: () => <hr className="my-4 border-zinc-600" />,
  };

  return (
    <div
      className={`w-full flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`${
          message.role === "user" ? "bg-zinc-900" : "bg-zinc-800"
        } p-4 rounded-md max-w-[80%]`}
      >
        <ReactMarkdown components={components}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}