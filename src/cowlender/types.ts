export interface CowlenderUser {
  id: number;
  name: string;
  isRegistered: boolean;
}

export interface CowlenderPermissions {
  view: boolean;
  create: boolean;
  editOwn: boolean;
  editAll: boolean;
  delete: boolean;
  admin: boolean;
}

export interface CowlenderCategory {
  slug: string;
  label: string;
  color: string;
}

export interface CowlenderMeta {
  apiVersion: number;
  defaultTimezone: string;
  statuses: string[];
  categories: CowlenderCategory[];
  limits: {
    maxRangeDays: number;
    maxEventsPerRequest: number;
  };
  recurrenceSupported: boolean;
  user: CowlenderUser;
  permissions: CowlenderPermissions;
}

export interface EventActor {
  id: number;
  name: string;
}

export interface CowlenderEvent {
  id: number;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
  status: string;
  category: string | null;
  externalUrl: string | null;
  recurrenceRule: string | null;
  createdBy: EventActor;
  createdAt: string;
  updatedBy: EventActor;
  updatedAt: string;
  version: number;
}

export interface EventRevision {
  id: number;
  eventId: number;
  eventVersion: number;
  action: 'create' | 'update' | 'delete' | string;
  actor: EventActor;
  changedAt: string;
  event: CowlenderEvent;
}

export interface EventInput {
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
  status: string;
  category: string | null;
  externalUrl: string | null;
}

export interface EventUpdateInput extends EventInput {
  version: number;
}

export interface EventListResponse {
  events: CowlenderEvent[];
  range: {
    start: string;
    end: string;
  };
  truncated: boolean;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  errors?: Record<string, unknown>;
}
