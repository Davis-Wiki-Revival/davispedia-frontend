import {
  Clock,
  ExternalLink,
  History,
  MapPin,
  Pencil,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CowlenderApiError, readableApiError, type CowlenderApi } from '../api';
import { eventDateRangeLabel } from '../date';
import type { CowlenderEvent, CowlenderMeta } from '../types';

interface EventDetailsProps {
  api: CowlenderApi;
  eventId: number;
  meta: CowlenderMeta;
  onClose: () => void;
  onDeleted: () => void;
  onEdit: (event: CowlenderEvent) => void;
}

function dateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function revisionActionLabel(action: string): string {
  if (action === 'create') return 'Created';
  if (action === 'update') return 'Updated';
  if (action === 'delete') return 'Deleted';
  return action;
}

export function EventDetails({ api, eventId, meta, onClose, onDeleted, onEdit }: EventDetailsProps) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const eventQuery = useQuery({
    queryKey: ['cowlender', 'event', eventId],
    queryFn: ({ signal }) => api.getEvent(eventId, signal),
  });

  const historyQuery = useQuery({
    queryKey: ['cowlender', 'event', eventId, 'revisions'],
    queryFn: ({ signal }) => api.listRevisions(eventId, signal),
    enabled: showHistory,
  });

  const deleteMutation = useMutation({
    mutationFn: (event: CowlenderEvent) => api.deleteEvent(event.id, event.version),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['cowlender', 'event', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['cowlender', 'events'] });
      onDeleted();
    },
  });

  const event = eventQuery.data;
  const category = useMemo(
    () => meta.categories.find((candidate) => candidate.slug === event?.category),
    [event?.category, meta.categories],
  );
  const canEdit = Boolean(event) && (
    meta.permissions.editAll
    || (meta.permissions.editOwn && event?.createdBy.id === meta.user.id)
  );

  const handleDelete = async () => {
    if (!event || !window.confirm(`Delete “${event.title}”? This cannot be undone.`)) {
      return;
    }

    setActionError(null);
    try {
      await deleteMutation.mutateAsync(event);
    } catch (error) {
      if (error instanceof CowlenderApiError && error.code === 'version_conflict') {
        await eventQuery.refetch();
        setActionError('This event changed after you opened it. The latest version has been loaded.');
      } else {
        setActionError(readableApiError(error));
      }
    }
  };

  if (eventQuery.isPending) {
    return <div className="cowlender-loading">Loading event…</div>;
  }

  if (eventQuery.isError || !event) {
    return (
      <div className="cowlender-empty">
        <div className="cowlender-alert cowlender-alert--error">
          {readableApiError(eventQuery.error)}
        </div>
        <button className="cowlender-button" onClick={() => void eventQuery.refetch()} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="cowlender-details">
      {actionError && <div className="cowlender-alert cowlender-alert--error">{actionError}</div>}

      <div className="cowlender-details__badges">
        {category && (
          <span className="cowlender-category" style={{ borderColor: category.color }}>
            <span aria-hidden="true" style={{ backgroundColor: category.color }} />
            {category.label}
          </span>
        )}
        <span className={`cowlender-status cowlender-status--${event.status}`}>{event.status}</span>
      </div>

      <dl className="cowlender-details__facts">
        <div>
          <dt><Clock aria-hidden="true" size={17} /> When</dt>
          <dd>{eventDateRangeLabel(event)}</dd>
        </div>
        {event.location && (
          <div>
            <dt><MapPin aria-hidden="true" size={17} /> Where</dt>
            <dd>{event.location}</dd>
          </div>
        )}
        <div>
          <dt><User aria-hidden="true" size={17} /> Added by</dt>
          <dd>{event.createdBy.name}</dd>
        </div>
      </dl>

      {event.description && (
        <section className="cowlender-details__section">
          <h3>Description</h3>
          <p className="cowlender-details__description">{event.description}</p>
        </section>
      )}

      {event.externalUrl && (
        <a className="cowlender-external-link" href={event.externalUrl} rel="noreferrer" target="_blank">
          Event website
          <ExternalLink aria-hidden="true" size={15} />
        </a>
      )}

      <div className="cowlender-details__meta">
        Last updated by {event.updatedBy.name} on {dateTimeLabel(event.updatedAt)}
      </div>

      <div className="cowlender-details__actions">
        <button className="cowlender-button" onClick={() => setShowHistory((shown) => !shown)} type="button">
          <History aria-hidden="true" size={16} />
          {showHistory ? 'Hide history' : 'View history'}
        </button>
        <span className="cowlender-details__action-spacer" />
        {canEdit && (
          <button className="cowlender-button" onClick={() => onEdit(event)} type="button">
            <Pencil aria-hidden="true" size={16} />
            Edit
          </button>
        )}
        {meta.permissions.delete && (
          <button
            className="cowlender-button cowlender-button--danger"
            disabled={deleteMutation.isPending}
            onClick={() => void handleDelete()}
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <button className="cowlender-button cowlender-button--primary" onClick={onClose} type="button">
          Done
        </button>
      </div>

      {showHistory && (
        <section className="cowlender-history">
          <h3>Change history</h3>
          {historyQuery.isError && (
            <div className="cowlender-alert cowlender-alert--error">
              {readableApiError(historyQuery.error)}
            </div>
          )}
          {historyQuery.isPending && <div className="cowlender-loading">Loading history…</div>}
          {historyQuery.data?.length === 0 && <p>No revision records were found.</p>}
          {historyQuery.data && historyQuery.data.length > 0 && (
            <ol>
              {historyQuery.data.map((revision) => (
                <li key={revision.id}>
                  <strong>{revisionActionLabel(revision.action)}</strong>
                  <span> by {revision.actor.name}</span>
                  <time dateTime={revision.changedAt}>{dateTimeLabel(revision.changedAt)}</time>
                  <small>Version {revision.eventVersion}</small>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
