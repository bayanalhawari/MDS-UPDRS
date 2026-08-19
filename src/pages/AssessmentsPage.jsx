/**
 * AssessmentsPage.jsx
 * Lists all recorded MDS-UPDRS assessments across all patients.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../router";
import { getPatients } from "../services/patients";
import { getAssessments } from "../services/assessments";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AssessmentsPage() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [patientsData, assessmentsData] = await Promise.all([
        getPatients(),
        getAssessments(),
      ]);
      setPatients(patientsData);
      setAssessments(assessmentsData);
    } catch (err) {
      console.error("Failed to load assessments", err);
      setLoadError("Could not load assessments.");
    } finally {
      setLoading(false);
    }
  }

  /** Lookup map for resolving a patientId to the full patient record. */
  const patientById = useMemo(() => {
    const map = new Map();
    for (const p of patients) map.set(p.id, p);
    return map;
  }, [patients]);

  /** All assessments, newest first. */
  const sortedAssessments = useMemo(() => {
    return [...assessments].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }, [assessments]);

  return (
    <div className="patients-page">
      <div className="patients-card">
        <h1>Assessments</h1>

        {loading ? (
          <p className="patients-status">Loading assessments…</p>
        ) : (
          <p className="patients-status">
            {sortedAssessments.length} assessment{sortedAssessments.length === 1 ? "" : "s"} recorded
          </p>
        )}

        {/* Empty state / results table */}
        {!loading && sortedAssessments.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No assessments recorded</p>
            <p className="empty-state__subtitle">
              Use "New assessment" to complete the first MDS-UPDRS form for a patient.
            </p>
          </div>
        ) : !loading && (
          <table className="table-container">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Assessment</th>
                <th>Examiner</th>
                <th>Total score</th>
                <th>Date &amp; time</th>
              </tr>
            </thead>
            <tbody>
              {sortedAssessments.map((a) => {
                const p = patientById.get(a.patientId);
                return (
                  <tr
                    key={a.id}
                    className="table-row--clickable"
                    onClick={() => navigate(`/patients/${a.patientId}/assessments/${a.id}`)}
                  >
                    <td>
                      {p?.id && <span> {p.id}</span>}
                    </td>
                    <td>MDS-UPDRS Part III</td>
                    <td>{a.examinerName || "—"}</td>
                    <td>{a.totalScore != null ? `${a.totalScore} / 132` : "—"}</td>
                    <td>{formatDateTime(a.startTime)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}