import { getWidgetType } from '../services/templateParser';

// ── OrdinalWidget ────────────────────────────────────────────────────────────
// Used for DV_ORDINAL (0–4 Parkinson severity scales).
// Each severity level (Normal, Slight, Mild, Moderate, Severe, …) shows its
// own explanatory description underneath the label at all times — not just
// as a hover tooltip — so the examiner can read the scoring criteria while
// choosing.
function OrdinalWidget({ field, value, onChange }) {
  return (
    <div className="ordinal-group" role="radiogroup" aria-label={field.name}>
      {field.options.map((opt) => {
        const active = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`ordinal-option ${active ? 'active' : ''}`}
          >
            <input
              type="radio"
              name={field.aqlPath}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
            />
            <span className="ordinal-option__head">
              <span className="ordinal-number">{opt.ordinal}</span>
              <span className="ordinal-label">{opt.label}</span>
            </span>
            {opt.description && (
              <span className="ordinal-description">{opt.description}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

// ── SelectWidget ─────────────────────────────────────────────────────────────
function SelectWidget({ field, value, onChange }) {
  return (
    <select
      className="form-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">— Select —</option>
      {field.options.map((opt) => (
        <option key={opt.value} value={opt.value} title={opt.description}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ── BooleanWidget ────────────────────────────────────────────────────────────
// Single checkbox instead of a Yes/No radio pair: ticking the box records
// "Yes" (true), leaving it empty records "No" (false).
function BooleanWidget({ field, value, onChange }) {
  const checked = value === true;
  return (
    <label className={`bool-checkbox ${checked ? 'active' : ''}`}>
      <input
        type="checkbox"
        name={field.aqlPath}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="bool-checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 16 12" className="bool-checkbox__tick">
          <polyline points="1,6 6,11 15,1" />
        </svg>
      </span>
      <span className="bool-checkbox__label">{checked ? 'Yes' : 'No'}</span>
    </label>
  );
}

// ── TextWidget ───────────────────────────────────────────────────────────────
function TextWidget({ field, value, onChange }) {
  return (
    <input
      type="text"
      className="form-input"
      value={value ?? ''}
      placeholder={field.description || field.name}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

// ── NumberWidget ─────────────────────────────────────────────────────────────
function NumberWidget({ field, value, onChange }) {
  return (
    <input
      type="number"
      className="form-input form-input--number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

// ── DateTimeWidget ───────────────────────────────────────────────────────────
function DateTimeWidget({ field, value, onChange }) {
  return (
    <input
      type="datetime-local"
      className="form-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

// ── MinutesWidget ────────────────────────────────────────────────────────────
// Used for "Last levodopa dose" (at0241): the archetype stores this as
// DV_DURATION — minutes elapsed since the last dose — so we collect a plain
// number here and convert it to an ISO 8601 duration ("PT90M") when the
// composition XML is built (see compositionXmlBuilder.js).
function MinutesWidget({ field, value, onChange }) {
  return (
    <div className="form-input-group">
      <input
        type="number"
        min="0"
        max="1439"
        step="1"
        className="form-input form-input--number"
        value={value ?? ''}
        placeholder="e.g. 90"
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
      <span className="form-input-suffix">minutes</span>
    </div>
  );
}

// ── TimeWidget ───────────────────────────────────────────────────────────────
function TimeWidget({ field, value, onChange }) {
  return (
    <input
      type="time"
      className="form-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

// ── Widget dispatcher ────────────────────────────────────────────────────────
function FieldWidget({ field, value, onChange }) {
  const type = getWidgetType(field);
  const props = { field, value, onChange };

  switch (type) {
    case 'ordinal':   return <OrdinalWidget {...props} />;
    case 'select':    return <SelectWidget {...props} />;
    case 'boolean':   return <BooleanWidget {...props} />;
    case 'number':    return <NumberWidget {...props} />;
    case 'datetime':  return <DateTimeWidget {...props} />;
    case 'time':      return <TimeWidget {...props} />;
    case 'minutes':   return <MinutesWidget {...props} />;
    default:          return <TextWidget {...props} />;
  }
}

// ── FormField (the exported component) ──────────────────────────────────────
export default function FormField({ field, value, onChange, error }) {
  const widgetType = getWidgetType(field);

  return (
    <div className={`form-field ${error ? 'form-field--error' : ''}`} data-widget={widgetType}>
      <div className="form-field__header">
        <label className="form-field__label">
          {field.name}
          {field.required && <span className="required-mark" aria-label="required"> *</span>}
        </label>
        {field.cluster && (
          <span className="form-field__cluster">{field.cluster}</span>
        )}
      </div>

      {field.description && (
        <p className="form-field__description">{field.description}</p>
      )}

      <FieldWidget field={field} value={value} onChange={onChange} />

      {error && <p className="form-field__error">{error}</p>}
    </div>
  );
}