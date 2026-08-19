/**
 * services/patients.js
 * API client for patient records (local DB).
 */

import axios from "axios";

const API = "http://localhost:3000";

/** Saves a new patient record. */
export async function savePatient(patient) {
  return axios.post(`${API}/patients`, patient);
}

/** Fetches all patient records. */
export async function getPatients() {
  const res = await axios.get(`${API}/patients`);
  return res.data;
}