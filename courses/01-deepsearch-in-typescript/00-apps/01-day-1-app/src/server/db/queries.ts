import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "./index";
import { users, userRequests, chats, messages } from "./schema";
import type { Message } from "ai";

const DAILY_REQUEST_LIMIT = 50; // Adjust this limit as needed

/**
 * Check if a user has exceeded their daily request limit
 * @param userId - The user's ID
 * @returns Object containing whether the user can make a request and their current count
 */
export async function checkRateLimit(userId: string) {
  // First, check if the user is an admin
  const user = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0) {
    throw new Error("User not found");
  }

  // If user is admin, bypass rate limit
  if (user[0]?.isAdmin) {
    return {
      canMakeRequest: true,
      isAdmin: true,
      currentCount: 0,
      limit: DAILY_REQUEST_LIMIT,
    };
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Check current request count for today
  const requestRecord = await db
    .select({
      requestCount: userRequests.requestCount,
    })
    .from(userRequests)
    .where(
      and(
        eq(userRequests.userId, userId),
        eq(userRequests.requestDate, today!)
      )
    )
    .limit(1);

  const currentCount = requestRecord[0]?.requestCount ?? 0;
  const canMakeRequest = currentCount < DAILY_REQUEST_LIMIT;

  return {
    canMakeRequest,
    isAdmin: false,
    currentCount,
    limit: DAILY_REQUEST_LIMIT,
  };
}

/**
 * Record a new request for a user
 * @param userId - The user's ID
 */
export async function recordRequest(userId: string) {
  const today = new Date().toISOString().split('T')[0];

  // Try to update existing record for today
  const result = await db
    .update(userRequests)
    .set({
      requestCount: sql`${userRequests.requestCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userRequests.userId, userId),
        eq(userRequests.requestDate, today!)
      )
    )
    .returning({ id: userRequests.id });

  // If no record was updated, create a new one
  if (result.length === 0) {
    await db.insert(userRequests).values({
      userId,
      requestDate: today!,
      requestCount: 1,
    });
  }
}

/**
 * Get user's request history (for admin/debugging purposes)
 * @param userId - The user's ID
 * @param days - Number of days to look back (default: 7)
 */
export async function getUserRequestHistory(userId: string, days: number = 7) {
  const result = await db
    .select({
      requestDate: userRequests.requestDate,
      requestCount: userRequests.requestCount,
    })
    .from(userRequests)
    .where(
      and(
        eq(userRequests.userId, userId),
        sql`${userRequests.requestDate} >= CURRENT_DATE - INTERVAL '${days} days'`
      )
    )
    .orderBy(userRequests.requestDate);

  return result;
}

/**
 * Upsert a chat with all its messages
 * @param opts - Options containing userId, chatId, title, and messages
 */
export async function upsertChat(opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Message[];
}) {
  const { userId, chatId, title, messages: aiMessages } = opts;

  return await db.transaction(async (tx) => {
    // Check if chat exists and belongs to the user
    const existingChat = await tx
      .select({ userId: chats.userId })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    // If chat exists but doesn't belong to user, throw error
    if (existingChat.length > 0 && existingChat[0]?.userId !== userId) {
      throw new Error("Chat does not belong to the logged in user");
    }

    // Upsert the chat
    await tx
      .insert(chats)
      .values({
        id: chatId,
        userId,
        title,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: chats.id,
        set: {
          title,
          updatedAt: new Date(),
        },
      });

    // Delete all existing messages for this chat
    await tx.delete(messages).where(eq(messages.chatId, chatId));

    // Insert new messages
    if (aiMessages.length > 0) {
      const messageData = aiMessages.map((message, index) => ({
        id: message.id || crypto.randomUUID(),
        chatId,
        role: message.role,
        parts: message.parts || null,
        order: index,
      }));

      await tx.insert(messages).values(messageData);
    }

    return { success: true };
  });
}

/**
 * Get a chat by ID with all its messages
 * @param chatId - The chat ID to retrieve
 * @param userId - The user ID (for authorization)
 */
export async function getChat(chatId: string, userId: string) {
  // First, get the chat info
  const chatResult = await db
    .select({
      id: chats.id,
      userId: chats.userId,
      title: chats.title,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  if (chatResult.length === 0) {
    return null;
  }

  // Then get the messages separately
  const messagesResult = await db
    .select({
      id: messages.id,
      role: messages.role,
      parts: messages.parts,
      order: messages.order,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.order);

  const chat = {
    id: chatResult[0]!.id,
    userId: chatResult[0]!.userId,
    title: chatResult[0]!.title,
    createdAt: chatResult[0]!.createdAt,
    updatedAt: chatResult[0]!.updatedAt,
    messages: messagesResult,
  };

  return chat;
}

/**
 * Get all chats for a user (without messages)
 * @param userId - The user ID
 */
export async function getChats(userId: string) {
  const userChats = await db
    .select({
      id: chats.id,
      title: chats.title,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));

  return userChats;
} 