/**
 * services/assessments.js
 * API client for assessment metadata (local DB), not the actual openEHR
 * composition (see services/ehrbase.js).
 */

import axios from "axios";

const API = "http://localhost:3000";

/**
 * Saves an assessment's metadata (who, when, patient, total score, pointer
 * to the EHRbase composition). Called AFTER the actual composition has been
 * successfully created in EHRbase.
 */
export async function saveAssessmentRecord(record) {
  const res = await axios.post(`${API}/assessments`, record);
  return res.data;
}

/**
 * Fetches the assessment history for a patient (or all patients, if no
 * patientId is given).
 */
export async function getAssessments(patientId) {
  const res = await axios.get(`${API}/assessments`, {
    params: patientId ? { patientId } : undefined,
  });
  return res.data;
}

/** Fetches a single assessment by its local ID. */
export async function getAssessment(assessmentId) {
  const res = await axios.get(`${API}/assessments/${assessmentId}`);
  return res.data;
}