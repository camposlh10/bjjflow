import { useQuery } from '@tanstack/react-query';
import { api, ApiError, getToken } from './api';
import type {
  ClassResponse,
  DashboardResponse,
  DeviceResponse,
  GymDto,
  InvoiceResponse,
  MemberResponse,
  PaymentPlanResponse,
  PaymentSummaryResponse,
  RevenueSeriesResponse,
} from './types';

export function useGym() {
  return useQuery<GymDto, ApiError>({
    queryKey: ['gym'],
    queryFn: () => api<GymDto>('/crm/gym'),
    enabled: Boolean(getToken()),
    staleTime: 60_000,
    retry: (count, error) => error.status >= 500 && count < 2,
  });
}

export function useDashboard() {
  return useQuery<DashboardResponse, ApiError>({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardResponse>('/crm/dashboard'),
  });
}

export function useMembers() {
  return useQuery<MemberResponse[], ApiError>({
    queryKey: ['members'],
    queryFn: () => api<MemberResponse[]>('/crm/members'),
    staleTime: 30_000,
  });
}

export function useClasses() {
  return useQuery<ClassResponse[], ApiError>({
    queryKey: ['classes'],
    queryFn: () => api<ClassResponse[]>('/crm/classes'),
    staleTime: 30_000,
  });
}

export function useInvoices(enabled = true) {
  return useQuery<InvoiceResponse[], ApiError>({
    queryKey: ['invoices'],
    queryFn: () => api<InvoiceResponse[]>('/crm/invoices'),
    enabled,
  });
}

export function usePaymentPlans(enabled = true) {
  return useQuery<PaymentPlanResponse[], ApiError>({
    queryKey: ['payment-plans'],
    queryFn: () => api<PaymentPlanResponse[]>('/crm/payment-plans'),
    enabled,
  });
}

export function usePaymentSummary(enabled = true) {
  return useQuery<PaymentSummaryResponse, ApiError>({
    queryKey: ['payment-summary'],
    queryFn: () => api<PaymentSummaryResponse>('/crm/payments/summary'),
    enabled,
  });
}

export function useRevenueSeries(days: number, enabled = true) {
  return useQuery<RevenueSeriesResponse, ApiError>({
    queryKey: ['revenue-series', days],
    queryFn: () => api<RevenueSeriesResponse>(`/crm/payments/revenue-series?days=${days}`),
    enabled,
  });
}

export function useDevices() {
  return useQuery<DeviceResponse[], ApiError>({
    queryKey: ['devices'],
    queryFn: () => api<DeviceResponse[]>('/crm/devices'),
  });
}
