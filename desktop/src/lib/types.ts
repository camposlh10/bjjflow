// Mirrors the Spring Boot DTOs in bjj-flow-backend.

// ---------- auth ----------
export interface AuthUser {
  id: number;
  displayName?: string;
  email?: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  mfaRequired: boolean;
  mfaToken: string | null;
}

// ---------- gym (shared with the mobile app) ----------
export interface GymDto {
  id: number;
  name: string;
  city: string | null;
  description: string | null;
  memberCount: number;
  role: 'OWNER' | 'INSTRUCTOR' | 'MEMBER';
  graduationTarget: number | null;
  instructorsOnlyPosts: boolean;
  inviteCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string | null;
  verified: boolean;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  youtube: string | null;
  googlePlaceId: string | null;
  createdAt: string;
}

export interface UpdateGymRequest {
  name: string;
  city?: string | null;
  description?: string | null;
  graduationTarget?: number | null;
  instructorsOnlyPosts?: boolean | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  youtube?: string | null;
  googlePlaceId?: string | null;
}

// ---------- dashboard ----------
export interface DashboardResponse {
  gymId: number;
  gymName: string;
  totalMembers: number;
  activeClasses: number;
  todayClasses: number;
  todayCheckIns: number;
  monthlyCheckIns: number;
}

// ---------- members ----------
export interface BeltResponse {
  slug: string;
  name: string;
  namePt: string;
  colorHex: string;
  stripes: number;
}

export interface MemberResponse {
  userId: number;
  displayName: string;
  role: 'OWNER' | 'INSTRUCTOR' | 'MEMBER';
  belt: BeltResponse | null;
  classesAttended: number;
}

export interface MemberDetailResponse {
  userId: number;
  username: string | null;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: 'OWNER' | 'INSTRUCTOR' | 'MEMBER';
  belt: BeltResponse | null;
  totalClasses: number;
  last30Days: number;
  lastAttended: string | null;
  memberSince: string | null;
}

// ---------- classes ----------
export type SessionType = 'GI' | 'NOGI' | 'OPEN_MAT';

export interface ClassResponse {
  id: number;
  name: string;
  sessionType: SessionType;
  dayOfWeek: number; // 1 = Monday … 7 = Sunday
  startTime: string; // HH:mm
  endTime: string;
  instructorUserId: number | null;
  active: boolean;
}

// ---------- attendance ----------
export interface AttendanceResponse {
  id: number;
  classId: number;
  className: string;
  date: string;
  userId: number;
  displayName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  markedByUserId: number | null;
}

export interface AccessEventReviewResponse {
  id: number;
  deviceId: number;
  deviceName: string | null;
  studentUserId: number | null;
  displayName: string | null;
  externalMemberId: string | null;
  eventTime: string;
  source: string;
  status: string;
  processed: boolean;
  matchedClassId: number | null;
  notes: string | null;
}

// ---------- payments ----------
export type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type BillingCycle = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
export type PaymentProvider = 'MANUAL' | 'CASH' | 'PIX' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export interface PaymentPlanResponse {
  id: number;
  gymId: number;
  memberUserId: number;
  memberName: string | null;
  name: string;
  amount: number;
  billingCycle: BillingCycle;
  startDate: string;
  nextDueDate: string;
  active: boolean;
  createdAt: string;
}

export interface InvoiceResponse {
  id: number;
  gymId: number;
  memberUserId: number;
  memberName: string | null;
  paymentPlanId: number | null;
  description: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  paidAt: string | null;
  transactionId: number | null;
  createdAt: string;
}

export interface GenerateInvoicesResponse {
  createdCount: number;
  skippedCount: number;
  invoices: InvoiceResponse[];
}

export interface PaymentSummaryResponse {
  activePlanCount: number;
  pendingInvoiceCount: number;
  pendingInvoiceAmount: number;
  overdueInvoiceCount: number;
  overdueInvoiceAmount: number;
  paymentsThisMonthCount: number;
  collectedThisMonthAmount: number;
}

export interface RevenuePoint {
  date: string;
  amount: number;
  transactionCount: number;
}

export interface RevenueSeriesResponse {
  from: string;
  to: string;
  totalAmount: number;
  points: RevenuePoint[];
}

// ---------- devices ----------
export interface DeviceResponse {
  id: number;
  gymId: number;
  name: string;
  type: string;
  provider: string | null;
  location: string | null;
  active: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
}

export interface DeviceWithKeyResponse {
  device: DeviceResponse;
  apiKey: string;
}

// ---------- credentials ----------
export type CredentialType = 'CARD' | 'FINGERPRINT' | 'QR' | 'PIN' | 'OTHER';

export interface CredentialResponse {
  id: number;
  gymId: number;
  userId: number;
  type: CredentialType;
  value: string;
  label: string | null;
  active: boolean;
  createdAt: string;
  revokedAt: string | null;
}
