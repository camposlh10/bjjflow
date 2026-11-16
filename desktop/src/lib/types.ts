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
  delinquent: boolean;
  age: number | null;
  /** Under the gym's adult age (kids program). */
  kid: boolean;
  /** A child profile the gym manages (no login of their own). */
  managed: boolean;
  noGuardian: boolean;
  missingDocuments: number;
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
  delinquent: boolean;
  birthDate: string | null;
  age: number | null;
  kid: boolean;
  managed: boolean;
}

// ---------- kids program ----------
export type Relationship = 'MOTHER' | 'FATHER' | 'GRANDPARENT' | 'OTHER';
export type DocumentKind = 'WAIVER' | 'MEDICAL' | 'IMAGE_CONSENT' | 'OTHER';
export type DocumentStatus = 'MISSING' | 'VALID' | 'EXPIRING' | 'EXPIRED';

export interface AgeGroupDto {
  id: number;
  name: string;
  minAge: number;
  maxAge: number;
}

export interface DocumentTypeDto {
  id: number;
  name: string;
  kind: DocumentKind;
  required: boolean;
  renewalMonths: number | null;
}

export interface KidsSettingsResponse {
  configured: boolean;
  checkoutRequired: boolean | null;
  pickupListOnly: boolean | null;
  latePickupMinutes: number | null;
  missingDocumentsPolicy: 'WARN' | 'BLOCK' | null;
  adultAge: number;
  ageGroups: AgeGroupDto[];
  documentTypes: DocumentTypeDto[];
  checklist: {
    kids: number;
    withoutGuardian: number;
    withMissingDocuments: number;
    withoutHealthInfo: number;
    withoutBirthDate: number;
  };
}

export interface GuardianDto {
  id: number;
  name: string;
  relationship: Relationship;
  phone: string | null;
  email: string | null;
  primaryContact: boolean;
  financialResponsible: boolean;
  status: 'PENDING' | 'ACTIVE';
  inviteCode: string | null;
  inviteExpiresAt: string | null;
  linkedAt: string | null;
  linkedAccountName: string | null;
}

export interface PickupDto {
  id: number;
  name: string;
  relationship: string | null;
  phone: string | null;
  notes: string | null;
  blocked: boolean;
}

export interface HealthDto {
  bloodType: string | null;
  allergies: string | null;
  conditions: string | null;
  medications: string | null;
  healthPlan: string | null;
  emergencyNotes: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

export interface StudentDocumentDto {
  type: DocumentTypeDto;
  status: DocumentStatus;
  recordId: number | null;
  signedByName: string | null;
  signedOn: string | null;
  expiresOn: string | null;
}

export interface FamilyResponse {
  userId: number;
  displayName: string;
  managed: boolean;
  birthDate: string | null;
  age: number | null;
  kid: boolean;
  ageGroup: string | null;
  programConfigured: boolean;
  guardians: GuardianDto[];
  pickups: PickupDto[];
  health: HealthDto | null;
  documents: StudentDocumentDto[];
  missingRequiredDocuments: number;
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
  /** Who recorded it: the student in the app, staff in the CRM, or a scan at the gym. */
  source: 'APP' | 'STAFF' | 'DEVICE';
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
  paymentReference: string | null;
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
  /** The bridge that reaches this device on the gym's network. */
  bridgeId: number | null;
  /** The device's address on the gym's network. */
  lanHost: string | null;
}

export interface DeviceWithKeyResponse {
  device: DeviceResponse;
  apiKey: string;
}

export interface BridgeResponse {
  id: number;
  name: string;
  active: boolean;
  /** Checked in within the last minute. */
  online: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  version: string | null;
  /** Notifications waiting on the bridge to reach the cloud. */
  queueDepth: number | null;
}

export interface BridgeWithKeyResponse {
  bridge: BridgeResponse;
  apiKey: string;
}

export interface EnrollmentResponse {
  id: number;
  deviceId: number;
  deviceName: string | null;
  method: 'FACE' | 'CARD';
  cardValue: string | null;
  status: 'PENDING' | 'ENROLLED' | 'FAILED' | 'REMOVING' | 'REMOVED';
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberAccessResponse {
  faceConsent: { id: number; termsVersion: string; grantedAt: string; recordedByUserId: number } | null;
  currentTermsVersion: string;
  enrollments: EnrollmentResponse[];
}

export interface PresenceResponse {
  count: number;
  members: {
    userId: number;
    displayName: string | null;
    enteredAt: string;
    deviceName: string | null;
    /** Had an overdue invoice when they came in. */
    overdue: boolean;
  }[];
  /** Some device reported exits today; otherwise each entry counts for 3 hours. */
  exitsTracked: boolean;
}

export interface BridgeCommandResponse {
  id: number;
  type: 'PING' | 'DEVICE_HTTP';
  status: 'PENDING' | 'SENT' | 'DONE' | 'FAILED';
  attempts: number;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ---------- notifications / automations ----------
export type AutomationEventType =
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_CONFIRMED'
  | 'DELINQUENT_FLAG'
  | 'ENGAGEMENT_NUDGE'
  | 'COACH_FOLLOW_UP'
  | 'RETENTION_ALERT'
  | 'CLASS_REMINDER'
  | 'CLASS_CANCELLED'
  | 'ANNOUNCEMENT';

export interface AutomationEventResponse {
  id: number;
  type: AutomationEventType;
  memberUserId: number | null;
  memberName: string | null;
  title: string;
  body: string | null;
  createdAt: string;
}

export interface AnnouncementResponse {
  recipientCount: number;
}

export interface RunAutomationsResponse {
  createdEvents: number;
}

// ---------- POS / card machines ----------
export interface PosIntegrationResponse {
  id: number;
  gymId: number;
  name: string;
  providerName: string;
  active: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
}

export interface PosIntegrationWithKeyResponse {
  integration: PosIntegrationResponse;
  webhookKey: string;
}

export type PosEventStatus =
  | 'RECEIVED'
  | 'PROCESSED'
  | 'DUPLICATE'
  | 'UNRESOLVED_INVOICE'
  | 'AMOUNT_MISMATCH'
  | 'ALREADY_PAID'
  | 'FAILED'
  | 'IGNORED';

export interface PosEventResponse {
  id: number;
  integrationName: string | null;
  externalTransactionId: string;
  paymentReference: string | null;
  invoiceId: number | null;
  invoiceDescription: string | null;
  memberUserId: number | null;
  memberName: string | null;
  amount: number;
  paymentMethod: string | null;
  cardBrand: string | null;
  installments: number | null;
  authorizationCode: string | null;
  status: PosEventStatus;
  notes: string | null;
  paidAt: string;
  createdAt: string;
}

// ---------- credentials ----------
export type CredentialType = 'CARD' | 'FINGERPRINT' | 'QR' | 'FACE' | 'PIN' | 'OTHER';

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
