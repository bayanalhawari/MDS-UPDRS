/**
 * PatientsPage.jsx
 * Lists all registered patients and provides a modal form to register a new
 * one. Registering a patient also creates a matching EHR in EHRbase.
 *
 * Only the function with automatically EHR ID and Personal ID creation were sopported with Claude ai.
 */

import React, { useState, useEffect } from "react";
import { createEhr } from "../services/ehrbase.js";
import { savePatient, getPatients } from "../services/patients.js";
import { useNavigate } from "../router";

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    dob: "",
    sex: "",
  });

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const data = await getPatients();
    setPatients(data);
  }

  function calculateAge(dob) {
    if (!dob) return "";
    const birth = new Date(dob);
    const now = new Date();
    return now.getFullYear() - birth.getFullYear();
  }

  async function registerPatient() {
    if (!form.firstname || !form.lastname) {
      alert("Firstname und Lastname sind Pflicht");
      return;
    }

    const subjectId = crypto.randomUUID();
    const ehrid = await createEhr(subjectId);

    function generatePatientId() {
      const hospitalCode = "HOS";
      const year = new Date().getFullYear();

      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((n) => (n % 36).toString(36).toUpperCase())
        .join("");

      return `${hospitalCode}-${year}-${randomPart}`;
    }

    const newPatient = {
      id: generatePatientId(),
      firstname: form.firstname,
      lastname: form.lastname,
      dob: form.dob,
      age: calculateAge(form.dob),
      sex: form.sex,
      ehrid: ehrid,
      createdAt: new Date().toISOString()
    };

    await savePatient(newPatient);
    await loadPatients();

       closeForm();
  }
 
  function closeForm() {
    setShowForm(false);
    setForm({ firstname: "", lastname: "", dob: "", sex: ""});
  }

  return (
    <div className="patients-page">
      <div className="patients-card">
      <div className="patients-header">
        <div>
          <h1>Patient List</h1>
          <p className="patients-status">
            {patients.length === 0
              ? "No patients registered yet."
              : `${patients.length} registered `}
          </p>
        </div>
 
        <button className="btn btn--submit" onClick={() => setShowForm(true)}>
          + Register patient
        </button>
      </div>
 
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-card__title">Register new patient</h2>
            <p className="modal-card__subtitle">
              A new EHR will automatically be created in EHRbase for this patient.
            </p>
 
            <div className="modal-form">
              <div className="field-row">
                <label className="field">
                  <span className="field__label">First name</span>
                  <input
                    autoFocus
                    value={form.firstname}
                    onChange={(e) => setForm({ ...form, firstname: e.target.value })}
                  />
                </label>
 
                <label className="field">
                  <span className="field__label">Last name</span>
                  <input
                    value={form.lastname}
                    onChange={(e) => setForm({ ...form, lastname: e.target.value })}
                  />
                </label>
              </div>
 
              <div className="field-row">
                <label className="field">
                  <span className="field__label">Date of birth</span>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  />
                </label>
 
                <label className="field">
                  <span className="field__label">Sex</span>
                  <select
                    value={form.sex}
                    onChange={(e) => setForm({ ...form, sex: e.target.value })}
                  >
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
              </div>
            </div>
 
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={closeForm}>Cancel</button>
              <button className="btn btn--submit" onClick={registerPatient}>Register patient</button>
            </div>
          </div>
        </div>
      )}
 
      <table className="table-container">
        <thead>
          <tr>
            <th>ID</th>
            <th>Firstname</th>
            <th>Lastname</th>
            <th>DOB</th>
            <th>Age</th>
            <th>Sex</th>
            <th>Registered</th>
          </tr>
        </thead>

        <tbody>
          {patients.length === 0 ? (
            <tr>
              <td >
                <div className="empty-state">
                  <p className="empty-state__title">No patients on file</p>
                  <p className="empty-state__subtitle">
                    Use "Register patient" to create the first record.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            patients.map((p, i) => (
              <tr key={i} onClick={() => navigate(`/patients/${p.id}`)}>
                <td>{p.id}</td>
                <td>{p.firstname}</td>
                <td>{p.lastname}</td>
                <td>{p.dob}</td>
                <td>{p.age}</td>
                <td>{p.sex}</td>
                <td>
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString("de-DE")
                    : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
