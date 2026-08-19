import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "../router";
import { getPatients } from "../services/patients.js";
import { getAssessments } from "../services/assessments.js";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [assessmentsError, setAssessmentsError] = useState(null);

  useEffect(() => {
    loadPatient();
    loadAssessments();
  }, [id]);

  async function loadPatient() {
    const all = await getPatients();
    const found = all.find(p => p.id == id);
    setPatient(found);
  }

  async function loadAssessments() {
    setLoadingAssessments(true);
    setAssessmentsError(null);
    try {
      const data = await getAssessments(id);
      // Widerrufene Assessments raus, neueste zuerst.
      const active = data
        .filter((a) => !a.revoked)
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      setAssessments(active);
    } catch (err) {
      console.error("Failed to load assessments", err);
      setAssessmentsError("Could not load assessments.");
    } finally {
      setLoadingAssessments(false);
    }
  }

  if (!patient) return <div>Loading...</div>;

  return (
    <div className="patient-details-page">
      <div className="patient-details-card">

        <div className="patient-details-header">
          <h1>{patient.firstname} {patient.lastname}</h1>
          <button className="return-btn" onClick={() => navigate("/patients")}>
            Return to Patients
          </button>
        </div>

        <div className="demographics-box">
          <h2 className="demographics-title">Details</h2>

          <div className="demographics-grid">
            <p><strong>DOB:</strong> {patient.dob || "—"}</p>
            <p><strong>Sex:</strong> {patient.sex || "—"}</p>
            <p><strong>ID:</strong> {patient.id}</p>
            <p><strong>EHR ID:</strong> {patient.ehrid}</p>
            <p><strong>Registered:</strong> {new Date(patient.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="assessment-history">
          <h3>Assessment History</h3>

          {loadingAssessments ? (
            <p>Loading assessments…</p>
          ) : assessmentsError ? (
            <p className="error-banner">{assessmentsError}</p>
          ) : assessments.length === 0 ? (
            <p>No assessments recorded. Use “New assessment” to complete the first MDS-UPDRS form.</p>
          ) : (
            <table className="table-container">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Examiner</th>
                  <th>Total score</th>
                  <th>Date &amp; time</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map(a => (
                  <tr
                    key={a.id}
                    className="table-row--clickable"
                    onClick={() => navigate(`/patients/${id}/assessments/${a.id}`)}
                  >
                    <td>MDS-UPDRS Part III</td>
                    <td>{a.examinerName || "—"}</td>
                    <td>{a.totalScore != null ? `${a.totalScore} / 132` : "—"}</td>
                    <td>{formatDateTime(a.startTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button
          className="new-assessment-btn"
          onClick={() => navigate(`/new-assessment?patientId=${id}`)}
        >
          + New assessment
        </button>

      </div>
    </div>
  );
}
