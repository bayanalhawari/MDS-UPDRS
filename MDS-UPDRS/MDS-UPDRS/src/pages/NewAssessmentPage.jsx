/**
 * NewAssessmentPage.jsx
 * Multi-section MDS-UPDRS form for recording a new assessment. Renders form
 * fields dynamically from the parsed openEHR template, tracks per-section
 * completion, computes the Part III total score live, and on submit builds
 * the composition XML and saves it to EHRbase + the local assessment record.
 *
 * Support of Claude ai with the show of template elements  
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from '../router';
import { parseTemplate, validateField, computeTotalScore, TOTAL_SCORE_AQL } from '../services/templateParser';
import { getPatients } from '../services/patients';
import { buildCompositionXml } from '../services/CompositionXmlBuilder';
import { createComposition } from '../services/ehrbase';
import { saveAssessmentRecord } from '../services/assessments';
import FormField from '../components/FormField';
import template from '../services/template.json';


const ALL_SECTIONS = ['Part I-nM-EDL', 'Part II-M-EDL', 'Part III', 'Part IV-Motor Complications'];
const SECTION_LABELS = {
  'Part III': 'Part III-Motor Examination',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function flattenFields(items) {
  const out = [];
  for (const item of items) {
    if (item.kind === 'cluster') {
      out.push(...item.fields);
    } else {
      out.push(item);
    }
  }
  return out;
}

function SectionTab({ label, active, complete, total, onClick }) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  return (
    <button
      className={`section-tab ${active ? 'active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="section-tab__label">{label}</span>
      <span className="section-tab__progress">
        <span
          className="section-tab__bar"
          style={{ width: `${pct}%` }}
        />
      </span>
    </button>
  );
}

function TotalScoreBanner({ score }) {
  const MAX = 132;

  return (
    <div className="total-score-banner">
      <span className="total-score-banner__label">Total Score (3.1–3.18)</span>
      <div className="total-score-banner__value">
        {score != null ? score : '—'}
        <span className="total-score-banner__max">/ {MAX}</span>
      </div>
    </div>
  );
}

function ClusterBlock({ cluster, values, errors, onChange }) {
  return (
    <div className="cluster-block">
      <div className="form-field__header">
        <span className="form-field__label">{cluster.name}</span>
      </div>
      {cluster.description && (
        <p className="form-field__description">{cluster.description}</p>
      )}
      <div className="cluster-block__fields">
        {cluster.fields.map((field) => (
          <FormField
            key={field.aqlPath}
            field={field}
            value={values[field.aqlPath]}
            error={errors[field.aqlPath]}
            onChange={(val) => onChange(field.aqlPath, val)}
          />
        ))}
      </div>
    </div>
  );
}

function ObservationBlock({ title, items, values, errors, onChange }) {
  const visibleItems = items.filter(
    (item) => item.kind !== 'field' || item.aqlPath !== TOTAL_SCORE_AQL
  );

  return (
    <section className="obs-block">
      <div className="obs-block__fields">
        {visibleItems.map((item) =>
          item.kind === 'cluster' ? (
            <ClusterBlock
              key={item.aqlPath}
              cluster={item}
              values={values}
              errors={errors}
              onChange={onChange}
            />
          ) : (
            <FormField
              key={item.aqlPath}
              field={item}
              value={values[item.aqlPath]}
              error={errors[item.aqlPath]}
              onChange={(val) => onChange(item.aqlPath, val)}
            />
          )
        )}
      </div>
    </section>
  );
}

function EmptySectionPlaceholder({ label }) {
  return (
    <div className="obs-block obs-block--empty">
      <p className="comp-view__empty">
        {label} does not yet contain any fields in the current template. This tab has been set up as a
        placeholder and will be populated as soon as the template is expanded.
      </p>
    </div>
  );
}

function nowForDatetimeLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Header area: Patient , examiner name, assessment date,
// and (only while Part III is active) the Total Score. 
function AssessmentMetaPanel({
  patient, patients, onPatientChange,
  examinerName, onExaminerChange,
  assessmentDate, onDateChange,
  location, onLocationChange,
  siteId, onSiteIdChange,
  totalScore,
  showTotalScore,
}) {
  return (
    <div className="assessment-meta">
      <label className="assessment-meta__field">
        <span className="assessment-meta__label">Patient</span>
        <select
          className="form-select"
          value={patient?.id ?? ''}
          onChange={(e) => onPatientChange(e.target.value)}
        >
          <option value="" disabled>Select a patient…</option>
          {patient && !patients.some((p) => p.id === patient.id) && (
            <option value={patient.id}>
              {patient.firstname} {patient.lastname}
            </option>
          )}
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstname} {p.lastname}{p.ehrid ? ` (${p.ehrid.slice(0, 8)}…)` : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="assessment-meta__field">
        <span className="assessment-meta__label">Examiner</span>
        <input
          type="text"
          className="form-input"
          value={examinerName}
          placeholder="Examiner's name"
          onChange={(e) => onExaminerChange(e.target.value)}
        />
      </label>
      <label className="assessment-meta__field">
        <span className="assessment-meta__label">Assessment date</span>
        <input
          type="datetime-local"
          className="form-input"
          value={assessmentDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </label>
      <label className="assessment-meta__field">
        <span className="assessment-meta__label">
          Location<span className="required-mark" aria-label="required"> *</span>
        </span>
        <input
          type="text"
          className="form-input"
          value={location}
          placeholder="e.g. Neurology outpatient clinic, Room 3"
          onChange={(e) => onLocationChange(e.target.value)}
        />
      </label>
      <label className="assessment-meta__field">
        <span className="assessment-meta__label">Site ID</span>
        <input
          type="text"
          className="form-input"
          value={siteId}
          placeholder="e.g. Site-01"
          onChange={(e) => onSiteIdChange(e.target.value)}
        />
      </label>
      {showTotalScore && <TotalScoreBanner score={totalScore} />}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────
export default function NewAssessmentPage({ onSubmit }) {
  const { grouped, meta, fields: templateFields } = useMemo(() => parseTemplate(template), []);
  const sections = ALL_SECTIONS;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get('patientId');

  const [patients, setPatients] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getPatients();
      setPatients(data);
      const found = data.find((p) => p.id === patientId);
      setCurrentPatient(found ?? null);
      setLoadingPatients(false);
    }
    load();
  }, [patientId]);

  const handlePatientChange = (id) => {
    const next = patients.find((p) => p.id === id);
    if (next) setCurrentPatient(next);
  };

  const [activeSection, setActiveSection] = useState('Part III');
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const DEFAULT_EXAMINER_NAME = 'Dr. Test';
  const [examinerName, setExaminerName] = useState(DEFAULT_EXAMINER_NAME);
  const [assessmentDate, setAssessmentDate] = useState(nowForDatetimeLocal);
  const DEFAULT_LOCATION = 'Neurology outpatient clinic';
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [siteId, setSiteId] = useState('');
  const [metaError, setMetaError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleChange = (aqlPath, value) => {
    setValues((prev) => ({ ...prev, [aqlPath]: value }));
    if (errors[aqlPath]) {
      setErrors((prev) => { const n = { ...prev }; delete n[aqlPath]; return n; });
    }
  };

  const allFields = useMemo(() => {
    const out = [];
    for (const sec of sections) {
      for (const obs of Object.keys(grouped[sec] ?? {})) {
        out.push(...flattenFields(grouped[sec][obs]));
      }
    }
    return out;
  }, [grouped, sections]);

  const totalScore = useMemo(() => computeTotalScore(values, allFields), [values, allFields]);

  const sectionStats = useMemo(() => {
    const stats = {};
    for (const sec of sections) {
      let total = 0, complete = 0;
      for (const obs of Object.keys(grouped[sec] ?? {})) {
        for (const f of flattenFields(grouped[sec][obs])) {
          total++;
          if (values[f.aqlPath] !== undefined && values[f.aqlPath] !== null && values[f.aqlPath] !== '') {
            complete++;
          }
        }
      }
      stats[sec] = { total, complete };
    }
    return stats;
  }, [grouped, sections, values]);

  const handleSubmit = async () => {
    if (!currentPatient) {
      setMetaError('Please select a patient.');
      return;
    }
    if (!examinerName.trim()) {
      setMetaError("Please provide the examiner's name.");
      return;
    }
    if (!assessmentDate) {
      setMetaError('Please provide an assessment date.');
      return;
    }
    if (!location.trim()) {
      setMetaError('Please provide the location.');
      return;
    }
    setMetaError(null);

    const newErrors = {};
    for (const field of allFields) {
      const err = validateField(field, values[field.aqlPath]);
      if (err) newErrors[field.aqlPath] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const errPaths = Object.keys(newErrors);
      for (const sec of sections) {
        for (const obs of Object.keys(grouped[sec] ?? {})) {
          if (flattenFields(grouped[sec][obs]).some((f) => errPaths.includes(f.aqlPath))) {
            setActiveSection(sec);
            break;
          }
        }
        break;
      }
      return;
    }

    const submitData = { ...values };
    if (totalScore != null) submitData[TOTAL_SCORE_AQL] = totalScore;

    const isoStartTime = new Date(assessmentDate).toISOString();
    const trimmedExaminer = examinerName.trim();
    const trimmedLocation = location.trim();
    const trimmedSiteId = siteId.trim();

    setSubmitError(null);
    setSubmitting(true);

    try {
      const compositionXml = buildCompositionXml({
        templateId: meta.templateId,
        fields: templateFields,
        values: submitData,
        composerName: trimmedExaminer,
        subjectName: `${currentPatient.firstname} ${currentPatient.lastname}`,
        startTime: isoStartTime,
        location: trimmedLocation,
        siteId: trimmedSiteId,
      });

      const { uid: compositionUid } = await createComposition(currentPatient.ehrid, compositionXml);
      const savedRecord = await saveAssessmentRecord({
        patientId: currentPatient.id,
        ehrId: currentPatient.ehrid,
        compositionUid,
        examinerName: trimmedExaminer,
        totalScore: totalScore ?? null,
        startTime: isoStartTime,
        location: trimmedLocation,
        siteId: trimmedSiteId,
      });

      setSubmitting(false);
      setSubmitted(true);
      onSubmit?.(savedRecord);
    } catch (err) {
      console.error('Failed to save assessment', err);
      setSubmitting(false);
      setSubmitError(
        err?.response?.data?.message ||
        err?.message ||
        'Could not save this assessment. Please try again.'
      );
    }
  };

  if (loadingPatients) return <div>Loading...</div>;
  if (!currentPatient && patients.length === 0) {
    return (
      <div className="form-error">
        <p>No patients registered yet. Please register a patient first.</p>
        <button className="btn btn--ghost" onClick={() => navigate('/patients')}>
          Go to patient list
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="form-success">
        <div className="form-success__icon">✓</div>
        <h2>Assessment submitted</h2>
        <p>
          The MDS-UPDRS form data has been recorded for {currentPatient.firstname} {currentPatient.lastname}.
        </p>
        <div className="form-success__actions">
          <button
            className="btn btn--secondary"
            onClick={() => {
              setSubmitted(false);
              setValues({});
              setErrors({});
              setExaminerName(DEFAULT_EXAMINER_NAME);
              setAssessmentDate(nowForDatetimeLocal());
              setLocation(DEFAULT_LOCATION);
              setSiteId('');
              setSubmitError(null);
            }}
          >
            New assessment
          </button>
          <button className="btn btn--ghost" onClick={() => navigate(`/patients/${currentPatient.id}`)}>
            Back to patient
          </button>
        </div>
      </div>
    );
  }

  const observations = grouped[activeSection] ?? {};
  const hasObservations = Object.keys(observations).length > 0;

  return (
    <div className="mds-form">
      
      {/* ── Patient / Examiner / Assessment date / (Part III: Total Score) ── */}
      <AssessmentMetaPanel
        patient={currentPatient}
        patients={patients}
        onPatientChange={handlePatientChange}
        examinerName={examinerName}
        onExaminerChange={(v) => { setExaminerName(v); if (metaError) setMetaError(null); }}
        assessmentDate={assessmentDate}
        onDateChange={(v) => { setAssessmentDate(v); if (metaError) setMetaError(null); }}
        location={location}
        onLocationChange={(v) => { setLocation(v); if (metaError) setMetaError(null); }}
        siteId={siteId}
        onSiteIdChange={setSiteId}
        totalScore={totalScore}
        showTotalScore={activeSection === 'Part III'}
      />
      {metaError && <p className="error-banner" style={{ margin: '0 2.5rem 1rem' }}>{metaError}</p>}
      {submitError && <p className="error-banner" style={{ margin: '0 2.5rem 1rem' }}>{submitError}</p>}

      {/* ── Section tabs ── */}
      <nav className="section-tabs" aria-label="Form sections">
        {sections.map((sec) => (
          <SectionTab
            key={sec}
            label={SECTION_LABELS[sec] ?? sec}
            active={sec === activeSection}
            complete={sectionStats[sec]?.complete ?? 0}
            total={sectionStats[sec]?.total ?? 0}
            onClick={() => setActiveSection(sec)}
          />
        ))}
      </nav>

      {/* ── Active section ── */}
      <div className="mds-form__body">
        {hasObservations ? (
          Object.entries(observations).map(([obsName, items]) => (
            <ObservationBlock
              key={obsName}
              title={obsName}
              items={items}
              values={values}
              errors={errors}
              onChange={handleChange}
            />
          ))
        ) : (
          <EmptySectionPlaceholder label={activeSection} />
        )}
      </div>

      {/* ── Submit ── */}
      {activeSection === 'Part III' && (
        <div className="mds-form__nav">
          <button
            className="btn btn--ghost"
            type="button"
            disabled={submitting}
            onClick={() => navigate(currentPatient ? `/patients/${currentPatient.id}` : '/patients')}
          >
            Cancel
          </button>
          <button
            className="btn btn--submit"
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Saving…' : 'Submit assessment'}
          </button>
        </div>
      )}

    </div>
  );
}