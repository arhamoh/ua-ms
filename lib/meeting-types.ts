// Plain, client-safe types shared between the meetings page and its components.

export type MeetingStatus = 'REQUESTED' | 'APPROVED' | 'DECLINED' | 'CANCELLED';

export interface MeetingDTO {
  id: string;
  title: string;
  description: string | null;
  clientName: string | null;
  status: MeetingStatus;
  startISO: string | null;
  endISO: string | null;
  durationMin: number;
  proposedByApprover: boolean;
  declineReason: string | null;
  withMeet: boolean;
  meetLink: string | null;
  googleHtmlLink: string | null;
  requesterId: string;
  requesterName: string;
  approverId: string;
  approverName: string;
  attendees: string[]; // display names / emails
}

export interface CalEvent {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  status: MeetingStatus;
  meetLink: string | null;
  sub?: string;
}
