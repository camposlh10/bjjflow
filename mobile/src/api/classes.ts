import { api } from './client';

export type SessionType = 'GI' | 'NOGI' | 'OPEN_MAT';
export type RestrictionMode = 'ALL' | 'KIDS' | 'ADULTS' | 'BELTS';

export type ClassBelt = {
  slug: string;
  namePt: string;
  colorHex: string;
  stripes: number;
};

export type ClassDef = {
  id: number;
  name: string;
  instructorName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  restrictionMode: RestrictionMode;
  restrictionLabel: string | null;
};

export type AgendaOccurrence = {
  classId: number;
  name: string;
  instructorName: string | null;
  sessionType: SessionType;
  startTime: string;
  endTime: string;
  date: string;
  restrictionLabel: string | null;
  eligible: boolean;
  checkedIn: boolean;
  canCheckIn: boolean;
  reserved: boolean;
  canReserve: boolean;
  attendeeCount: number;
};

export type AttendanceStatus = 'PRESENT' | 'RESERVED';

export type Attendee = {
  userId: number;
  displayName: string;
  belt: ClassBelt | null;
  status: AttendanceStatus;
};
export type RosterEntry = {
  userId: number;
  displayName: string;
  belt: ClassBelt | null;
  present: boolean;
};

export type CreateClassPayload = {
  name: string;
  instructorUserId?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  restrictionMode: RestrictionMode;
  allowedBeltSlugs?: string[];
};

export const SESSION_LABEL: Record<SessionType, string> = {
  GI: 'Gi',
  NOGI: 'No-Gi',
  OPEN_MAT: 'Open Mat',
};

export async function listClasses(): Promise<ClassDef[]> {
  const { data } = await api.get<ClassDef[]>('/gyms/classes');
  return data;
}

export async function createClass(payload: CreateClassPayload): Promise<ClassDef> {
  const { data } = await api.post<ClassDef>('/gyms/classes', payload);
  return data;
}

export async function deleteClass(id: number): Promise<void> {
  await api.delete(`/gyms/classes/${id}`);
}

export async function getAgenda(from: string, to: string): Promise<AgendaOccurrence[]> {
  const { data } = await api.get<AgendaOccurrence[]>('/gyms/classes/agenda', { params: { from, to } });
  return data;
}

export async function checkInClass(id: number, date: string): Promise<AgendaOccurrence> {
  const { data } = await api.post<AgendaOccurrence>(`/gyms/classes/${id}/checkin`, { date });
  return data;
}

/** Reserva (ou cancela a reserva, se já reservado) de uma aula futura. */
export async function reserveClass(id: number, date: string): Promise<AgendaOccurrence> {
  const { data } = await api.post<AgendaOccurrence>(`/gyms/classes/${id}/reserve`, { date });
  return data;
}

export async function getAttendees(id: number, date: string): Promise<Attendee[]> {
  const { data } = await api.get<Attendee[]>(`/gyms/classes/${id}/attendees`, { params: { date } });
  return data;
}

export async function getRoster(id: number, date: string): Promise<RosterEntry[]> {
  const { data } = await api.get<RosterEntry[]>(`/gyms/classes/${id}/roster`, { params: { date } });
  return data;
}

export async function markAttendance(
  id: number,
  date: string,
  userId: number,
  present: boolean,
): Promise<void> {
  await api.post(`/gyms/classes/${id}/attendance`, { date, userId, present });
}
