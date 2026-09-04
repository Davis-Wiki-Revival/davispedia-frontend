import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { EventInput as FullCalendarEventInput } from '@fullcalendar/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CowlenderApi, readableApiError } from './api';
import { Dialog } from './components/Dialog';
import { EventDetails } from './components/EventDetails';
import { EventForm } from './components/EventForm';
import { buildMonthGrid, eventDateRangeLabel, monthForDate, todayInTimeZone } from './date';
import type { CowlenderCategory, CowlenderEvent } from './types';

interface CowlenderAppProps {
  apiBaseUrl: string;
}

interface CalendarRange {
  start: string;
  end: string;
}

type ActiveDialog =
  | { kind: 'create'; date: string; time?: string }
  | { kind: 'details'; eventId: number }
  | { kind: 'edit'; event: CowlenderEvent }
  | null;

const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];

function matchesSearch(event: CowlenderEvent, search: string): boolean {
  if (!search) {
    return true;
  }
  const haystack = `${event.title}\n${event.description}\n${event.location}`.toLocaleLowerCase();
  return haystack.includes(search.toLocaleLowerCase());
}

function categoryColor(categories: CowlenderCategory[], slug: string | null): string {
  return categories.find((category) => category.slug === slug)?.color || '#6b7280';
}

function toCalendarEvent(
  event: CowlenderEvent,
  categories: CowlenderCategory[],
): FullCalendarEventInput {
  const color = categoryColor(categories, event.category);
  return {
    id: String(event.id),
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    backgroundColor: color,
    borderColor: color,
    classNames: [`cowlender-fc-event--${event.status}`],
    extendedProps: { cowlenderEvent: event },
  };
}

export function CowlenderApp({ apiBaseUrl }: CowlenderAppProps) {
  const api = useMemo(() => new CowlenderApi(apiBaseUrl), [apiBaseUrl]);
  const queryClient = useQueryClient();
  const initialToday = useMemo(() => todayInTimeZone('America/Los_Angeles'), []);
  const initialGrid = useMemo(
    () => buildMonthGrid(monthForDate(initialToday)),
    [initialToday],
  );
  const [range, setRange] = useState<CalendarRange>({
    start: initialGrid.rangeStart,
    end: initialGrid.rangeEnd,
  });
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const metaQuery = useQuery({
    queryKey: ['cowlender', 'meta'],
    queryFn: ({ signal }) => api.getMeta(signal),
    staleTime: 5 * 60 * 1000,
  });

  const eventsQuery = useQuery({
    queryKey: ['cowlender', 'events', range.start, range.end],
    queryFn: ({ signal }) => api.listEvents(range.start, range.end, signal),
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const meta = metaQuery.data;
  const events = eventsQuery.data?.events || [];
  const filteredEvents = useMemo(() => events.filter((event) => (
    (!categoryFilter || event.category === categoryFilter)
    && (!statusFilter || event.status === statusFilter)
    && matchesSearch(event, search.trim())
  )), [categoryFilter, events, search, statusFilter]);

  const calendarEvents = useMemo(
    () => meta ? filteredEvents.map((event) => toCalendarEvent(event, meta.categories)) : [],
    [filteredEvents, meta],
  );

  const closeDialog = useCallback(() => setActiveDialog(null), []);
  const showSavedEvent = (savedEvent: CowlenderEvent, message: string) => {
    queryClient.setQueryData(['cowlender', 'event', savedEvent.id], savedEvent);
    void queryClient.invalidateQueries({ queryKey: ['cowlender', 'events'] });
    void queryClient.invalidateQueries({
      queryKey: ['cowlender', 'event', savedEvent.id, 'revisions'],
    });
    setActiveDialog({ kind: 'details', eventId: savedEvent.id });
    setNotice(message);
  };

  const selectedTitle = activeDialog?.kind === 'details'
    ? events.find((event) => event.id === activeDialog.eventId)?.title
    : null;

  if (metaQuery.isPending) {
    return <div className="cowlender-loading">Loading The Cowlender…</div>;
  }

  if (metaQuery.isError || !meta) {
    return (
      <div className="cowlender-app cowlender-app--error">
        <div className="cowlender-alert cowlender-alert--error">
          {readableApiError(metaQuery.error)}
        </div>
        <button className="cowlender-button" onClick={() => void metaQuery.refetch()} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="cowlender-app">
      <div className="cowlender-controls">
        <div className="cowlender-filters">
          <label className="cowlender-search">
            <Search aria-hidden="true" size={17} />
            <span className="cowlender-visually-hidden">Search events</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span className="cowlender-visually-hidden">Filter by category</span>
            <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="">All categories</option>
              {meta.categories.map((category) => (
                <option key={category.slug} value={category.slug}>{category.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="cowlender-visually-hidden">Filter by status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">All statuses</option>
              {meta.statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <span className="cowlender-filters__count">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>
        {meta.permissions.create && (
          <button
            className="cowlender-button cowlender-button--primary"
            onClick={() => setActiveDialog({
              kind: 'create',
              date: todayInTimeZone(meta.defaultTimezone),
            })}
            type="button"
          >
            <CalendarPlus aria-hidden="true" size={17} />
            Add event
          </button>
        )}
      </div>

      {!meta.user.isRegistered && (
        <div className="cowlender-alert">
          You can browse events while signed out. Sign in to add or manage events.
        </div>
      )}
      {notice && <div className="cowlender-alert cowlender-alert--success">{notice}</div>}
      {eventsQuery.data?.truncated && (
        <div className="cowlender-alert cowlender-alert--warning">
          This date range contains more than {meta.limits.maxEventsPerRequest} events. Some are not shown.
        </div>
      )}
      {eventsQuery.isError && (
        <div className="cowlender-alert cowlender-alert--error cowlender-alert--with-action">
          <span>{readableApiError(eventsQuery.error)}</span>
          <button className="cowlender-button" onClick={() => void eventsQuery.refetch()} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            Retry
          </button>
        </div>
      )}

      <div className={`cowlender-calendar-frame${eventsQuery.isFetching ? ' cowlender-calendar-frame--loading' : ''}`}>
        <FullCalendar
          allDayText="All day"
          buttonText={{ today: 'Today', month: 'Month', week: 'Week', list: 'List' }}
          dateClick={(dateInfo) => {
            if (meta.permissions.create) {
              setActiveDialog({
                kind: 'create',
                date: dateInfo.dateStr.slice(0, 10),
                time: dateInfo.allDay ? undefined : dateInfo.dateStr.slice(11, 16),
              });
            }
          }}
          datesSet={(dateInfo) => {
            const nextRange = {
              start: dateInfo.startStr.slice(0, 10),
              end: dateInfo.endStr.slice(0, 10),
            };
            setRange((current) => (
              current.start === nextRange.start && current.end === nextRange.end
                ? current
                : nextRange
            ));
          }}
          dayMaxEvents
          displayEventEnd
          eventClick={(clickInfo) => {
            clickInfo.jsEvent.preventDefault();
            setActiveDialog({ kind: 'details', eventId: Number(clickInfo.event.id) });
          }}
          eventDidMount={(mountInfo) => {
            const event = mountInfo.event.extendedProps.cowlenderEvent as CowlenderEvent | undefined;
            if (event) {
              mountInfo.el.title = `${event.title} — ${eventDateRangeLabel(event)}`;
            }
          }}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          events={calendarEvents}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth',
          }}
          height="auto"
          initialDate={initialToday}
          initialView="dayGridMonth"
          nowIndicator
          plugins={CALENDAR_PLUGINS}
          selectable={meta.permissions.create}
        />
        {eventsQuery.isFetching && (
          <div aria-live="polite" className="cowlender-calendar-frame__loading">Loading events…</div>
        )}
      </div>

      <footer className="cowlender-footer">
        Calendar times use your browser timezone. Event details preserve each event’s configured timezone.
      </footer>

      {activeDialog?.kind === 'create' && (
        <Dialog onClose={closeDialog} title="Add event" wide>
          <EventForm
            api={api}
            initialDate={activeDialog.date}
            initialTime={activeDialog.time}
            meta={meta}
            onCancel={closeDialog}
            onSaved={(savedEvent) => showSavedEvent(savedEvent, 'Event created.')}
          />
        </Dialog>
      )}

      {activeDialog?.kind === 'edit' && (
        <Dialog onClose={closeDialog} title={`Edit ${activeDialog.event.title}`} wide>
          <EventForm
            api={api}
            event={activeDialog.event}
            initialDate={activeDialog.event.start.slice(0, 10)}
            meta={meta}
            onCancel={() => setActiveDialog({ kind: 'details', eventId: activeDialog.event.id })}
            onSaved={(savedEvent) => showSavedEvent(savedEvent, 'Event updated.')}
          />
        </Dialog>
      )}

      {activeDialog?.kind === 'details' && (
        <Dialog onClose={closeDialog} title={selectedTitle || 'Event details'} wide>
          <EventDetails
            api={api}
            eventId={activeDialog.eventId}
            key={activeDialog.eventId}
            meta={meta}
            onClose={closeDialog}
            onDeleted={() => {
              closeDialog();
              setNotice('Event deleted.');
            }}
            onEdit={(event) => setActiveDialog({ kind: 'edit', event })}
          />
        </Dialog>
      )}
    </div>
  );
}
