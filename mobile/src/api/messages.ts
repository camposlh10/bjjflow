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

export async function getMessages(conversationId: number): Promise<DirectMessage[]> {
  const { data } = await api.get<DirectMessage[]>(`/conversations/${conversationId}/messages`);
  return data;
}

export async function sendMessage(conversationId: number, content: string): Promise<DirectMessage> {
  const { data } = await api.post<DirectMessage>(`/conversations/${conversationId}/messages`, { content });
  return data;
}
