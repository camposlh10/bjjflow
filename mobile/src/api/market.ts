import { api } from './client';

export type Product = {
  id: number;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  link: string | null;
  orderCount: number;
  orderedByMe: boolean;
};

export type CreateProductPayload = {
  name: string;
  description?: string;
  priceCents: number;
  imageKey?: string;
  link?: string;
};

export function formatPrice(cents: number): string {
  const reais = Math.floor(cents / 100);
  const cent = cents % 100;
  const reaisStr = reais.toLocaleString('pt-BR');
  return cent === 0 ? `R$ ${reaisStr}` : `R$ ${reaisStr},${String(cent).padStart(2, '0')}`;
}

export async function getProducts(): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/gyms/market');
  return data;
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const { data } = await api.post<Product>('/gyms/market', payload);
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`/gyms/market/${id}`);
}

export async function buyProduct(id: number): Promise<Product> {
  const { data } = await api.post<Product>(`/gyms/market/${id}/buy`);
  return data;
}
