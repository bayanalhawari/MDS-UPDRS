/**
 * AssessmentDetails.jsx
 * ----------------------------------------------------------------------------
 * Displays a single MDS-UPDRS Part III (Motor Examination) assessment for a
 * given patient. Data is fetched from EHRbase, flattened, grouped by the
 * openEHR template structure, and rendered as a read-only clinical summary.
 *
 * NOTE: This file was generated with the assistance of Claude AI (Anthropic)
 * and subsequently reviewed and adapted.
 * ----------------------------------------------------------------------------
 */

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "../router";
import { GrReturn } from "react-icons/gr";

import { getPatients } from "../services/patients";
import { getAssessment } from "../services/assessments";
import { getComposition } from "../services/ehrbase";
import { parseTemplate, groupFlatComposition } from "../services/templateParser";
import template from "../services/template.json";

// ============================================================================
// Constants
// ============================================================================

/** Pre-parsed template field definitions (openEHR template → flat field list). */
const { fields: TEMPLATE_FIELDS } = parseTemplate(template);

/** Archetype node ID (at-code) of the MDS-UPDRS Part III total score item. */
const TOTAL_SCORE_NEEDLE = "at0227";

/** Maximum achievable total score for MDS-UPDRS Part III (items 3.1–3.18). */
const TOTAL_SCORE_MAX = 132;

/**
 * Path prefixes that identify openEHR/RM metadata fields (language, composer,
 * context, etc.) rather than actual clinical content. Used to filter the
 * flattened composition down to clinically relevant items only.
 */
const METADATA_PATH_PREFIXES = [
  "language",
  "territory",
  "category",
  "composer",
  "context/",
  "uid",
  "archetype_details",
  "name",
  "encoding",
  "_uid",
  "_composer",
];

/**
 * Human-readable label fragments that indicate a metadata field, used as a
 * fallback filter when the idPath alone is not conclusive.
 */
const METADATA_LABEL_NEEDLES = [
  "category",
  "start time",
  "end time",
  "location",
  "setting",
  "language",
  "encoding",
  "territory",
  "composer",
  "context",
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determines whether a flattened composition item represents openEHR/RM
 * metadata (as opposed to actual clinical content) based on its path.
 *
 * @param {string} idPath - Dot/slash-separated path of the composition item.
 * @returns {boolean} True if the item should be treated as metadata.
 */
function isMetadataPath(idPath) {
  if (!idPath) return true;
  const firstSegment = idPath.split("/")[0];
  return METADATA_PATH_PREFIXES.some(
    (prefix) => idPath.startsWith(prefix) || firstSegment === prefix.replace("/", "")
  );
}

/**
 * Determines whether a composition item's display label indicates metadata,
 * used as a secondary check alongside {@link isMetadataPath}.
 *
 * @param {string} label - Human-readable label of the composition item.
 * @returns {boolean} True if the label matches a known metadata pattern.
 */
function isMetadataLabel(label) {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return METADATA_LABEL_NEEDLES.some(
    (needle) => normalized === needle || normalized.startsWith(needle)
  );
}

/**
 * Formats an ISO 8601 date-time string for display using the browser's
 * locale settings.
 *
 * @param {string} iso - ISO 8601 date-time string.
 * @returns {string} Localized date-time string, or "—" if not provided.
 */
function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Filters out metadata and the pre-computed total-score item from a grouped
 * section list, keeping only clinically relevant, displayable items.
 *
 * @param {Array<Object>} groups - Sections grouped by observation/section.
 * @returns {Array<Object>} Filtered sections, with empty ones removed.
 */
function filterClinicalContent(groups) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.idPath?.includes(TOTAL_SCORE_NEEDLE) &&
          !isMetadataPath(item.idPath) &&
          !isMetadataLabel(item.label)
      ),
    }))
    .filter((group) => group.items.length > 0);
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Displays the assessment's total score alongside its maximum possible value.
 *
 * @param {{ score: number | null }} props
 */
function ScoreBadge({ score }) {
  return (
    <div className="assess-score-badge">
      <span className="assess-score-badge__label">Total Score (3.1–3.18)</span>
      <div className="assess-score-badge__value">
        {score ?? "—"}
        <span className="assess-score-badge__max"> / {TOTAL_SCORE_MAX}</span>
      </div>
    </div>
  );
}

/**
 * Renders the key/value metadata row for the assessment (examiner, date,
 * location, site ID).
 *
 * @param {{ assessment: Object }} props
 */
function AssessmentMeta({ assessment }) {
  return (
    <dl className="assessment-view__meta">
      <div>
        <dt>Examiner</dt>
        <dd>{assessment.examinerName || "—"}</dd>
      </div>
      <div>
        <dt>Date &amp; time</dt>
        <dd>{formatDateTime(assessment.startTime)}</dd>
      </div>
      <div>
        <dt>Location</dt>
        <dd>{assessment.location || "—"}</dd>
      </div>
      {assessment.siteId && (
        <div>
          <dt>Site ID</dt>
          <dd>{assessment.siteId}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Renders a single clinical observation block (e.g. "3.1 Speech") with all
 * of its associated items.
 *
 * @param {{ group: Object }} props
 */
function ObservationBlock({ group }) {
  return (
    <section className="assess-obs-block">
      <h2 className="assess-obs-block__title">{group.observation || group.section}</h2>
      <div className="assess-obs-block__items">
        {group.items.map((item) => (
          <div key={item.idPath} className="assess-item-row">
            <span className="assess-item-row__label">
              {item.label}
              {item.cluster && (
                <span className="assess-item-row__cluster"> · {item.cluster}</span>
              )}
            </span>
            <span
              className={`assess-item-row__value ${
                item.ordinal != null ? `assess-item-row__value--ord-${item.ordinal}` : ""
              }`}
            >
              {String(item.value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Main component
// ============================================================================

/**
 * Route-level page component that loads and displays a single MDS-UPDRS
 * Part III assessment for a patient.
 *
 * Data flow:
 *   1. Fetch the patient list and the assessment record in parallel.
 *   2. Fetch the raw EHRbase composition for that assessment.
 *   3. Flatten + group the composition according to the openEHR template.
 *   4. Filter out metadata / total-score items, keeping clinical content only.
 */
export default function AssessmentDetails() {
  const { id: patientId, assessmentId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssessmentData() {
      setLoading(true);
      setLoadError(null);

      try {
        // Step 1: patient list + assessment record in parallel.
        const [patients, assessmentRecord] = await Promise.all([
          getPatients(),
          getAssessment(assessmentId),
        ]);
        if (cancelled) return;

        setPatient(patients.find((p) => p.id === patientId) ?? null);
        setAssessment(assessmentRecord);

        // Step 2: raw composition from EHRbase.
        const flatComposition = await getComposition(
          assessmentRecord.ehrId,
          assessmentRecord.compositionUid
        );
        if (cancelled) return;

        // Step 3 + 4: group by template structure, then strip metadata/noise.
        const groupedSections = groupFlatComposition(flatComposition, TEMPLATE_FIELDS);
        setSections(filterClinicalContent(groupedSections));
      } catch (err) {
        console.error("Failed to load assessment", err);
        if (!cancelled) {
          setLoadError(
            err?.response?.data?.message ||
              err?.message ||
              "Could not load this assessment from EHRbase."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAssessmentData();
    return () => {
      cancelled = true;
    };
  }, [patientId, assessmentId]);

  // Sections are sorted alphabetically for a stable, predictable display order.
  const sortedSections = useMemo(() => {
    if (!sections) return [];
    return [...sections].sort((a, b) => a.section.localeCompare(b.section));
  }, [sections]);

  // ---- Render states -------------------------------------------------------

  if (loading) {
    return <div className="mds-form">Loading assessment…</div>;
  }

  if (loadError) {
    return (
      <div className="mds-form">
        <button className="btn btn--ghost" onClick={() => navigate(`/patients/${patientId}`)}>
          <GrReturn /> Back to patient
        </button>
        <p className="error-banner" style={{ marginTop: "1rem" }}>
          {loadError}
        </p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="mds-form">
        <p className="error-banner">Assessment not found.</p>
      </div>
    );
  }

  // ---- Main render -----------------------------------------------------------

  return (
    <div className="mds-form assessment-view">
      <div className="assessment-view__topbar">
        <button className="btn btn--ghost" onClick={() => navigate(`/patients/${patientId}`)}>
          <GrReturn /> Back to patient
        </button>
      </div>

      {/* Header: reads like a normal assessment summary, not a raw data dump */}
      <div className="assessment-view__header">
        <div>
          <h1>MDS-UPDRS Part III — Motor Examination</h1>
          <p className="assessment-view__subtitle">{patient?.id ? ` ${patient.id}` : ""}</p>
        </div>
        <ScoreBadge score={assessment.totalScore} />
      </div>

      <AssessmentMeta assessment={assessment} />

      {/* Clinical content, grouped exactly like the original form */}
      <div className="assessment-view__body">
        {sortedSections.length === 0 ? (
          <p className="comp-view__empty">No item data found for this assessment.</p>
        ) : (
          sortedSections.map((group) => (
            <ObservationBlock key={`${group.section}-${group.observation}`} group={group} />
          ))
        )}
      </div>
    </div>
  );
}