/**
 * AssessmentDetails.jsx
 * ----------------------------------------------------------------------------
 * Displays a single MDS-UPDRS Part III (Motor Examination) assessment for a
 * given patient. Data is fetched from EHRbase, flattened, grouped by the
 * openEHR template structure, and rendered as a read-only clinical summary.
 *
 * NOTE: The show of Assessment Details from Ehrbase were supported with Claude ai
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


const { fields: TEMPLATE_FIELDS } = parseTemplate(template);

const TOTAL_SCORE_NEEDLE = "at0227";

const TOTAL_SCORE_MAX = 132;

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

function isMetadataPath(idPath) {
  if (!idPath) return true;
  const firstSegment = idPath.split("/")[0];
  return METADATA_PATH_PREFIXES.some(
    (prefix) => idPath.startsWith(prefix) || firstSegment === prefix.replace("/", "")
  );
}

function isMetadataLabel(label) {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return METADATA_LABEL_NEEDLES.some(
    (needle) => normalized === needle || normalized.startsWith(needle)
  );
}
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
        const [patients, assessmentRecord] = await Promise.all([
          getPatients(),
          getAssessment(assessmentId),
        ]);
        if (cancelled) return;

        setPatient(patients.find((p) => p.id === patientId) ?? null);
        setAssessment(assessmentRecord);
        const flatComposition = await getComposition(
          assessmentRecord.ehrId,
          assessmentRecord.compositionUid
        );
        if (cancelled) return;
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