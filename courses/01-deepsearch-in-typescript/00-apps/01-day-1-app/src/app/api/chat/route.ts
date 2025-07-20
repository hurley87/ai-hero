import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { z } from "zod";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { model } from "~/models";
import { searchSerper } from "~/serper";
import { auth } from "~/server/auth";
import { upsertChat } from "~/server/db/queries";
import { bulkCrawlWebsites } from "~/server/scraper";
import { checkRateLimit, recordRateLimit } from "~/server/redis/rate-limit";

export const maxDuration = 60;

const langfuse = new Langfuse({
  environment: env.NODE_ENV,
});

// Rate limit configuration: 1 request per 5 seconds for testing
const rateLimitConfig = {
  maxRequests: 1,
  maxRetries: 3,
  windowMs: 5_000,
  keyPrefix: "global_llm",
};

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check rate limit before processing the request
  try {
    const rateLimitCheck = await checkRateLimit(rateLimitConfig);
    
    if (!rateLimitCheck.allowed) {
      console.log("Rate limit exceeded, waiting...");
      const isAllowed = await rateLimitCheck.retry();
      
      if (!isAllowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: `Rate limit exceeded. Please try again later.`,
            resetTime: new Date(rateLimitCheck.resetTime).toISOString(),
            remaining: rateLimitCheck.remaining,
          }),
          { 
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": rateLimitConfig.maxRequests.toString(),
              "X-RateLimit-Remaining": rateLimitCheck.remaining.toString(),
              "X-RateLimit-Reset": new Date(rateLimitCheck.resetTime).toISOString(),
            }
          }
        );
      }
    }

    // Record the request (only if rate limit check passed)
    await recordRateLimit({
      windowMs: rateLimitConfig.windowMs,
      keyPrefix: rateLimitConfig.keyPrefix,
    });
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return new Response("Internal server error", { status: 500 });
  }
  
  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId: string;
    isNewChat: boolean;
  };

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const { messages, chatId, isNewChat } = body;

      // Use the provided stable chatId
      const currentChatId = chatId;

      // Create a Langfuse trace for this chat session
      const trace = langfuse.trace({
        sessionId: currentChatId,
        name: "chat",
        userId: session.user.id,
      });

      // If this is a new chat, send the chat ID to the frontend
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: currentChatId,
        });
      }

      // Create or update the chat with the user's message before starting the stream
      // This ensures we have a chat record even if the stream fails
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage?.role === "user") {
        const chatTitle = 
          typeof lastUserMessage.content === "string" 
            ? lastUserMessage.content.slice(0, 100) 
            : "New Chat";
        
        await upsertChat({
          userId: session.user.id,
          chatId: currentChatId,
          title: chatTitle,
          messages,
        });
      }

      const result = streamText({
        model,
        messages,
        experimental_telemetry: { 
          isEnabled: true,
          functionId: "agent",
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
        system: `You are a strategic research assistant with expertise in finding, analyzing, and synthesizing information from multiple sources. Your responses are thorough, well-structured, and always backed by current data.

IDENTITY AND APPROACH:
- You communicate like a knowledgeable friend explaining complex topics clearly
- You prioritize accuracy and clarity over speed
- You build understanding progressively, starting with core concepts
- You anticipate and address potential follow-up questions
- You use real-world examples to illustrate points

CURRENT CONTEXT:
The current date and time is ${new Date().toLocaleString()}. Consider this timestamp when evaluating the recency and relevance of information.

RESEARCH PROCESS:
1. PLANNING
   - Break down complex queries into specific research goals
   - Identify key concepts and relationships to investigate
   - Consider multiple angles and potential information gaps

2. INFORMATION GATHERING
   - Use searchWeb to find diverse, authoritative sources
   - Prioritize official documentation and reputable publications
   - Gather 4-6 relevant sources for comprehensive coverage
   - Always verify information through multiple sources

3. CONTENT ANALYSIS
   - Use scrapePages to get full context from promising sources
   - Cross-reference information across multiple sources
   - Identify and resolve any contradictions
   - Note information gaps or uncertainties

4. RESPONSE FORMATTING:
   - Structure responses with clear sections and logical flow
   - Use **bold text** for key facts and important conclusions
   - Format all links as inline markdown: [title](url)
   - Include publication dates when available
   - Use paragraphs for natural transitions between ideas

CITATION GUIDELINES:
- Always cite sources using markdown links: [source name](url)
- Include publication dates when available: [Article Title (June 2023)](url)
- Cite multiple sources to support key claims
- Be transparent about information age and relevance

TOOL USAGE:
searchWeb:
- Use for initial discovery of relevant sources
- Search with multiple queries to cover different aspects
- Prioritize recent and authoritative sources
- Always get 10 results to ensure comprehensive coverage

scrapePages:
- Always scrape full content of promising pages
- Verify scraped content is relevant and complete
- Have fallback sources if scraping fails
- Use search snippets only if scraping is blocked

ERROR HANDLING:
- If scraping fails, try alternative sources
- If search results are insufficient, try different search terms
- Be transparent about any limitations or gaps in available information
- Clearly state when information might be outdated or uncertain

QUALITY CHECKS:
- Verify claims across multiple sources
- Consider source credibility and recency
- Acknowledge limitations and uncertainties
- Provide context for technical terms and concepts
- Balance depth with clarity and conciseness`,
        maxSteps: 10,
        tools: {
          searchWeb: {
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );
        
              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
                date: result.date,
              }));
            },
          },
          scrapePages: {
            parameters: z.object({
              urls: z.array(z.string()).describe("The URLs of the pages to scrape"),
            }),
            execute: async ({ urls }, { abortSignal }) => {
              const results = await bulkCrawlWebsites({ urls });
              return results;
            },
          },
        },
        onFinish: async ({ response }) => {
          try {
            const responseMessages = response.messages;
            
            const updatedMessages = appendResponseMessages({
              messages,
              responseMessages,
            });

            // Save the complete conversation to the database
            const chatTitle = 
              typeof messages[0]?.content === "string" 
                ? messages[0].content.slice(0, 100) 
                : "New Chat";

            await upsertChat({
              userId: session.user.id,
              chatId: currentChatId,
              title: chatTitle,
              messages: updatedMessages,
            });

            // Flush the Langfuse trace
            await langfuse.flushAsync();
          } catch (error) {
            console.error("Failed to save chat:", error);
            // Don't throw here to avoid breaking the response stream
          }
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
} 