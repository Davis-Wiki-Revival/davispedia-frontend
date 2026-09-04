import type {
  CowlenderEvent,
  CowlenderMeta,
  EventInput,
  EventListResponse,
  EventRevision,
  EventUpdateInput,
  ProblemDetails,
} from './types';

export class CowlenderApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: Record<string, unknown>;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail || problem.title || `Cowlender request failed (${status}).`);
    this.name = 'CowlenderApiError';
    this.status = status;
    this.code = problem.code || 'request_failed';
    this.errors = problem.errors || {};
  }
}

export class CowlenderApi {
  private readonly baseUrl: string;
  private csrfToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  getMeta(signal?: AbortSignal): Promise<CowlenderMeta> {
    return this.request<CowlenderMeta>('/meta', { signal });
  }

  listEvents(start: string, end: string, signal?: AbortSignal): Promise<EventListResponse> {
    const query = new URLSearchParams({ start, end });
    return this.request<EventListResponse>(`/events?${query.toString()}`, { signal });
  }

  async getEvent(id: number, signal?: AbortSignal): Promise<CowlenderEvent> {
    const response = await this.request<{ event: CowlenderEvent }>(`/events/${id}`, { signal });
    return response.event;
  }

  async createEvent(input: EventInput): Promise<CowlenderEvent> {
    const response = await this.write<{ event: CowlenderEvent }>('/events', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.event;
  }

  async updateEvent(id: number, input: EventUpdateInput): Promise<CowlenderEvent> {
    const response = await this.write<{ event: CowlenderEvent }>(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return response.event;
  }

  async deleteEvent(id: number, version: number): Promise<CowlenderEvent> {
    const query = new URLSearchParams({ version: String(version) });
    const response = await this.write<{ deleted: boolean; event: CowlenderEvent }>(
      `/events/${id}?${query.toString()}`,
      { method: 'DELETE' },
    );
    return response.event;
  }

  async listRevisions(id: number, signal?: AbortSignal): Promise<EventRevision[]> {
    const response = await this.request<{ revisions: EventRevision[] }>(
      `/events/${id}/revisions`,
      { signal },
    );
    return response.revisions;
  }

  private async write<T>(path: string, init: RequestInit): Promise<T> {
    let token = await this.getCsrfToken();

    try {
      return await this.request<T>(path, {
        ...init,
        headers: this.writeHeaders(init.headers, token),
      });
    } catch (error) {
      if (!(error instanceof CowlenderApiError) || error.code !== 'invalid_csrf_token') {
        throw error;
      }

      token = await this.getCsrfToken(true);
      return this.request<T>(path, {
        ...init,
        headers: this.writeHeaders(init.headers, token),
      });
    }
  }

  private writeHeaders(headers: HeadersInit | undefined, token: string): Headers {
    const resolved = new Headers(headers);
    resolved.set('Content-Type', 'application/json');
    resolved.set('X-CSRF-Token', token);
    return resolved;
  }

  private async getCsrfToken(refresh = false): Promise<string> {
    if (this.csrfToken && !refresh) {
      return this.csrfToken;
    }

    let response: { query?: { tokens?: { csrftoken?: string } } };
    const MediaWikiApi = window.mw?.Api;
    if (MediaWikiApi) {
      const mediaWikiApi = new MediaWikiApi();
      response = await mediaWikiApi.get({
        action: 'query',
        meta: 'tokens',
        type: 'csrf',
        formatversion: 2,
      });
    } else {
      const configuredScriptPath = window.mw?.config.get('wgScriptPath');
      const scriptPath = typeof configuredScriptPath === 'string' ? configuredScriptPath : '';
      const apiUrl = `${scriptPath}/api.php?action=query&meta=tokens&type=csrf&formatversion=2&format=json`;
      const tokenResponse = await fetch(apiUrl, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!tokenResponse.ok) {
        throw new CowlenderApiError(tokenResponse.status, {
          detail: 'Could not obtain a MediaWiki CSRF token.',
        });
      }
      response = await tokenResponse.json() as typeof response;
    }

    const token = response.query?.tokens?.csrftoken;
    if (!token) {
      throw new CowlenderApiError(403, {
        code: 'missing_csrf_token',
        detail: 'MediaWiki did not return a CSRF token. Try signing in again.',
      });
    }

    this.csrfToken = token;
    return token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('json');
    const body = isJson ? await response.json() as unknown : null;

    if (!response.ok) {
      const problem = body && typeof body === 'object'
        ? body as ProblemDetails
        : { detail: `Cowlender request failed (${response.status}).` };
      throw new CowlenderApiError(response.status, problem);
    }

    return body as T;
  }
}

export function readableApiError(error: unknown): string {
  if (error instanceof CowlenderApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
