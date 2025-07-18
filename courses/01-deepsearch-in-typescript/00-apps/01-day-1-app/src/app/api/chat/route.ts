import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { z } from "zod";
import { model } from "~/models";
import { searchSerper } from "~/serper";
import { auth } from "~/server/auth";
import { checkRateLimit, recordRequest, upsertChat } from "~/server/db/queries";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check rate limit before processing the request
  try {
    const rateLimitCheck = await checkRateLimit(session.user.id);
    
    if (!rateLimitCheck.canMakeRequest) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: `You have exceeded your daily limit of ${rateLimitCheck.limit} requests. Current count: ${rateLimitCheck.currentCount}. Limit resets at midnight UTC.`,
          currentCount: rateLimitCheck.currentCount,
          limit: rateLimitCheck.limit,
        }),
        { 
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitCheck.limit.toString(),
            "X-RateLimit-Remaining": Math.max(0, rateLimitCheck.limit - rateLimitCheck.currentCount).toString(),
            "X-RateLimit-Reset": new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }
        }
      );
    }

    // Record the request (only if rate limit check passed)
    await recordRequest(session.user.id);
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
        system: `You are a helpful AI assistant with access to real-time web search capabilities. 

IMPORTANT INSTRUCTIONS:
- Always use the searchWeb tool to find current, accurate information when answering questions
- Search for relevant information even if you think you might know the answer, as web search provides the most up-to-date information
- Always cite your sources with inline links using markdown format: [source title](url)
- Provide comprehensive answers based on multiple search results when possible
- If search results are insufficient, perform additional searches with different query terms
- Be transparent about what information comes from web search vs your training data

When responding:
1. Search for relevant information using the searchWeb tool
2. Synthesize the information from multiple sources
3. Provide inline citations for all claims and facts
4. Structure your response clearly with proper formatting`,
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
              }));
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