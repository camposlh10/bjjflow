import { api } from './client';

export type DMParticipant = {
  id: number;
  username: string | null;
  displayName: string;
  pro: boolean;
  avatarUrl: string | null;
};

export type Conversation = {
  id: number;
  other: DMParticipant;
  lastMessage: string | null;
  lastFromMe: boolean;
  lastMessageAt: string | null;
  unread: number;
};

export type DirectMessage = {
  id: number;
  senderId: number;
  fromMe: boolean;
  content: string;
  createdAt: string;
};

export async function getConversations(): Promise<Conversation[]> {
  const { data } = await api.get<Conversation[]>('/conversations');
  return data;
}

/** Get-or-create a 1:1 conversation with a user. */
export async function startConversation(userId: number): Promise<Conversation> {
  const { data } = await api.post<Conversation>('/conversations', { userId });
  return data;
}

/**
 * Messages in chronological order.
 * - `after`: only messages newer than that id (what a poll needs);
 * - `before`: the page of older messages just before that id;
 * - neither: the latest `limit` messages.
 */
export async function getMessages(
  conversationId: number,
  page: { limit?: number; before?: number; after?: number } = {},
): Promise<DirectMessage[]> {
  const { data } = await api.get<DirectMessage[]>(`/conversations/${conversationId}/messages`, {
    params: page,
  });
  return data;
}

/**
 * `clientId` is the app's own id for the message: resending the same one
 * returns the original instead of posting it twice (see offline/outbox).
 */
export async function sendMessage(
  conversationId: number,
  content: string,
  clientId?: string,
): Promise<DirectMessage> {
  const { data } = await api.post<DirectMessage>(`/conversations/${conversationId}/messages`, {
    content,
    clientId,
  });
  return data;
}
