import { Save } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { CowlenderApiError, readableApiError, type CowlenderApi } from '../api';
import { addDays, zonedLocalToRfc3339 } from '../date';
import type { CowlenderEvent, CowlenderMeta, EventInput } from '../types';

interface EventFormProps {
  api: CowlenderApi;
  meta: CowlenderMeta;
  initialDate: string;
  initialTime?: string;
  event?: CowlenderEvent;
  onCancel: () => void;
  onSaved: (event: CowlenderEvent) => void;
}

interface FormState {
  title: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  timezone: string;
  status: string;
  category: string;
  externalUrl: string;
}

type FormErrors = Partial<Record<keyof FormState | 'form', string>>;

function initialState(
  meta: CowlenderMeta,
  initialDate: string,
  initialTime?: string,
  event?: CowlenderEvent,
): FormState {
  if (event) {
    return {
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: event.start.slice(0, 10),
      startTime: event.allDay ? '18:00' : event.start.slice(11, 16),
      endDate: event.end.slice(0, 10),
      endTime: event.allDay ? '19:00' : event.end.slice(11, 16),
      allDay: event.allDay,
      timezone: event.timezone,
      status: event.status,
      category: event.category || '',
      externalUrl: event.externalUrl || '',
    };
  }

  const startTime = initialTime && /^\d{2}:\d{2}$/.test(initialTime) ? initialTime : '18:00';
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const endMinutes = startHour * 60 + startMinute + 60;
  const endTime = `${String(Math.floor((endMinutes % 1440) / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

  return {
    title: '',
    description: '',
    location: '',
    startDate: initialDate,
    startTime,
    endDate: endMinutes >= 1440 ? addDays(initialDate, 1) : initialDate,
    endTime,
    allDay: false,
    timezone: meta.defaultTimezone,
    status: meta.statuses[0] || 'scheduled',
    category: '',
    externalUrl: '',
  };
}

function errorText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }
  return null;
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const FORM_FIELDS = new Set<keyof FormState>([
  'title',
  'description',
  'location',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'allDay',
  'timezone',
  'status',
  'category',
  'externalUrl',
]);

function formFieldForApiField(field: string): keyof FormState | null {
  if (field === 'start') return 'startDate';
  if (field === 'end') return 'endDate';
  if (FORM_FIELDS.has(field as keyof FormState)) return field as keyof FormState;
  return null;
}

export function EventForm({
  api,
  meta,
  initialDate,
  initialTime,
  event,
  onCancel,
  onSaved,
}: EventFormProps) {
  const [form, setForm] = useState<FormState>(
    () => initialState(meta, initialDate, initialTime, event),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const saveMutation = useMutation({
    mutationFn: (input: EventInput) => event
      ? api.updateEvent(event.id, { ...input, version: event.version })
      : api.createEvent(input),
  });
  const saving = saveMutation.isPending;

  const update = <Key extends keyof FormState,>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const handleAllDayChange = (checked: boolean) => {
    setForm((current) => ({
      ...current,
      allDay: checked,
      endDate: checked && current.endDate <= current.startDate
        ? addDays(current.startDate, 1)
        : current.endDate,
    }));
    setErrors({});
  };

  const validateAndBuild = (): EventInput | null => {
    const nextErrors: FormErrors = {};
    const title = form.title.trim();
    const timezone = form.timezone.trim();

    if (!title) {
      nextErrors.title = 'Enter an event title.';
    }
    if (!form.startDate) {
      nextErrors.startDate = 'Choose a start date.';
    }
    if (!form.endDate) {
      nextErrors.endDate = 'Choose an end date.';
    }
    if (!timezone) {
      nextErrors.timezone = 'Enter an IANA timezone.';
    }

    let start = form.startDate;
    let end = form.endDate;
    if (form.allDay) {
      if (start && end && end <= start) {
        nextErrors.endDate = 'The end date must be after the start date.';
      }
    } else {
      if (!form.startTime) {
        nextErrors.startTime = 'Choose a start time.';
      }
      if (!form.endTime) {
        nextErrors.endTime = 'Choose an end time.';
      }
      if (timezone && form.startDate && form.startTime && form.endDate && form.endTime) {
        try {
          const localStart = `${form.startDate}T${form.startTime}`;
          const localEnd = `${form.endDate}T${form.endTime}`;
          start = event
            && event.timezone === timezone
            && event.start.slice(0, 16) === localStart
            ? event.start
            : zonedLocalToRfc3339(localStart, timezone);
          end = event
            && event.timezone === timezone
            && event.end.slice(0, 16) === localEnd
            ? event.end
            : zonedLocalToRfc3339(localEnd, timezone);
          if (new Date(end).getTime() <= new Date(start).getTime()) {
            nextErrors.endTime = 'The end must be after the start.';
          }
        } catch (error) {
          nextErrors.timezone = error instanceof Error ? error.message : 'Enter a valid timezone.';
        }
      }
    }

    const externalUrl = form.externalUrl.trim();
    if (externalUrl) {
      try {
        const parsed = new URL(externalUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          nextErrors.externalUrl = 'Use an absolute HTTP or HTTPS URL.';
        }
      } catch {
        nextErrors.externalUrl = 'Use an absolute HTTP or HTTPS URL.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return null;
    }

    return {
      title,
      description: form.description.trim(),
      location: form.location.trim(),
      start,
      end,
      allDay: form.allDay,
      timezone,
      status: form.status,
      category: form.category || null,
      externalUrl: externalUrl || null,
    };
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const input = validateAndBuild();
    if (!input) {
      return;
    }

    setErrors({});
    try {
      const saved = await saveMutation.mutateAsync(input);
      onSaved(saved);
    } catch (error) {
      const nextErrors: FormErrors = { form: readableApiError(error) };
      if (error instanceof CowlenderApiError) {
        for (const [field, value] of Object.entries(error.errors)) {
          const message = errorText(value);
          const formField = formFieldForApiField(field);
          if (message && formField) {
            nextErrors[formField] = message;
          }
        }
      }
      setErrors(nextErrors);
    }
  };

  return (
    <form className="cowlender-form" onSubmit={handleSubmit}>
      {errors.form && <div className="cowlender-alert cowlender-alert--error">{errors.form}</div>}

      <fieldset disabled={saving}>
        <label className="cowlender-field">
          <span>Title</span>
          <input
            aria-invalid={Boolean(errors.title)}
            autoFocus
            maxLength={255}
            onChange={(changeEvent) => update('title', changeEvent.target.value)}
            required
            type="text"
            value={form.title}
          />
          {errors.title && <small className="cowlender-field__error">{errors.title}</small>}
        </label>

        <label className="cowlender-checkbox">
          <input
            checked={form.allDay}
            onChange={(changeEvent) => handleAllDayChange(changeEvent.target.checked)}
            type="checkbox"
          />
          <span>All-day event</span>
        </label>

        <div className="cowlender-form__row">
          <label className="cowlender-field">
            <span>Start date</span>
            <input
              aria-invalid={Boolean(errors.startDate)}
              onChange={(changeEvent) => update('startDate', changeEvent.target.value)}
              required
              type="date"
              value={form.startDate}
            />
            {errors.startDate && <small className="cowlender-field__error">{errors.startDate}</small>}
          </label>
          {!form.allDay && (
            <label className="cowlender-field">
              <span>Start time</span>
              <input
                aria-invalid={Boolean(errors.startTime)}
                onChange={(changeEvent) => update('startTime', changeEvent.target.value)}
                required
                type="time"
                value={form.startTime}
              />
              {errors.startTime && <small className="cowlender-field__error">{errors.startTime}</small>}
            </label>
          )}
        </div>

        <div className="cowlender-form__row">
          <label className="cowlender-field">
            <span>End date</span>
            <input
              aria-invalid={Boolean(errors.endDate)}
              onChange={(changeEvent) => update('endDate', changeEvent.target.value)}
              required
              type="date"
              value={form.endDate}
            />
            {errors.endDate && <small className="cowlender-field__error">{errors.endDate}</small>}
            {form.allDay && <small>The end date is not included.</small>}
          </label>
          {!form.allDay && (
            <label className="cowlender-field">
              <span>End time</span>
              <input
                aria-invalid={Boolean(errors.endTime)}
                onChange={(changeEvent) => update('endTime', changeEvent.target.value)}
                required
                type="time"
                value={form.endTime}
              />
              {errors.endTime && <small className="cowlender-field__error">{errors.endTime}</small>}
            </label>
          )}
        </div>

        <div className="cowlender-form__row">
          <label className="cowlender-field">
            <span>Category</span>
            <select onChange={(changeEvent) => update('category', changeEvent.target.value)} value={form.category}>
              <option value="">No category</option>
              {meta.categories.map((category) => (
                <option key={category.slug} value={category.slug}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="cowlender-field">
            <span>Status</span>
            <select onChange={(changeEvent) => update('status', changeEvent.target.value)} value={form.status}>
              {meta.statuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="cowlender-field">
          <span>Location</span>
          <input
            maxLength={500}
            onChange={(changeEvent) => update('location', changeEvent.target.value)}
            type="text"
            value={form.location}
          />
        </label>

        <label className="cowlender-field">
          <span>Timezone</span>
          <input
            aria-invalid={Boolean(errors.timezone)}
            list="cowlender-timezones"
            maxLength={64}
            onChange={(changeEvent) => update('timezone', changeEvent.target.value)}
            required
            type="text"
            value={form.timezone}
          />
          <datalist id="cowlender-timezones">
            <option value={meta.defaultTimezone} />
            <option value="America/Los_Angeles" />
            <option value="UTC" />
          </datalist>
          {errors.timezone && <small className="cowlender-field__error">{errors.timezone}</small>}
        </label>

        <label className="cowlender-field">
          <span>Event website</span>
          <input
            aria-invalid={Boolean(errors.externalUrl)}
            maxLength={2048}
            onChange={(changeEvent) => update('externalUrl', changeEvent.target.value)}
            placeholder="https://example.org/event"
            type="url"
            value={form.externalUrl}
          />
          {errors.externalUrl && <small className="cowlender-field__error">{errors.externalUrl}</small>}
        </label>

        <label className="cowlender-field">
          <span>Description</span>
          <textarea
            maxLength={20000}
            onChange={(changeEvent) => update('description', changeEvent.target.value)}
            rows={6}
            value={form.description}
          />
        </label>
      </fieldset>

      <div className="cowlender-dialog__actions">
        <button className="cowlender-button" disabled={saving} onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="cowlender-button cowlender-button--primary" disabled={saving} type="submit">
          <Save aria-hidden="true" size={16} />
          {saving ? 'Saving…' : event ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </form>
  );
}
