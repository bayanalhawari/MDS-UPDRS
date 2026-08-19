/**
 * server.js
 * Minimal local backend for patient and assessment records. Data is
 * persisted as flat JSON files on disk (no real database) — sufficient for
 * local development, not for production use.
 */

import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());
const PATIENTS_FILE = "./patients.json";
const ASSESSMENTS_FILE = "./assessments.json";

function loadPatients() {
  if (!fs.existsSync(PATIENTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(PATIENTS_FILE));
}

function savePatients(data) {
  fs.writeFileSync(PATIENTS_FILE, JSON.stringify(data, null, 2));
}


function loadAssessments() {
  if (!fs.existsSync(ASSESSMENTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(ASSESSMENTS_FILE));
}

function saveAssessments(data) {
  fs.writeFileSync(ASSESSMENTS_FILE, JSON.stringify(data, null, 2));
}

// GET: all Patients
app.get("/patients", (req, res) => {
  res.json(loadPatients());
});

// POST: save neu Patient
app.post("/patients", (req, res) => {
  const patients = loadPatients();
  patients.push(req.body);
  savePatients(patients);
  res.json({ status: "ok" });
});

// GET: all Assessments 
app.get("/assessments", (req, res) => {
  const assessments = loadAssessments();
  const { patientId } = req.query;
  if (patientId) {
    return res.json(assessments.filter((a) => a.patientId === patientId));
  }
  res.json(assessments);
});

// GET /assessments/:id — returns a single assessment by its id. 
app.get("/assessments/:id", (req, res) => {
  const assessments = loadAssessments();
  const assessment = assessments.find((a) => a.id === req.params.id);
  if (!assessment) {
    return res.status(404).json({ message: "Assessment nicht gefunden" });
  }
  res.json(assessment);
});

// POST: save neu Assessment 
app.post("/assessments", (req, res) => {
  const assessments = loadAssessments();
  const record = {
    id: `AS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  assessments.push(record);
  saveAssessments(assessments);
  res.json(record);
});

app.listen(3000, () => console.log("Backend running on port 3000"));