# MDS-UPDRS Part III – Clinical Assessment Application

A React/Vite application for digitally capturing the **MDS-UPDRS Part III**
(Motor Examination). Assessments are stored as openEHR-compliant
compositions in **EHRbase**; patient and assessment metadata are managed by
a local Express backend.

## Architecture

```
React/Vite Frontend
   │
   ├──► Express server (server.js, port 3000)
   │     Patient master data & assessment metadata
   │     Persistence: patients.json / assessments.json
   │
   └──► EHRbase (external openEHR CDR)
         EHR creation, compositions (clinical raw data)
```

EHRbase holds the actual measurement data as standards-compliant
compositions. The local server only manages the metadata the UI needs for
lists/overviews (patient ↔ assessment ↔ composition UID), so the full
composition doesn't have to be loaded from EHRbase on every view.

## Features

- **Patient management**: create/list patients; on creation, an EHR is
  automatically created in EHRbase and its `ehr_id` stored with the patient.
- **Dynamic form**: Part III fields are generated at runtime from the
  openEHR Web Template (`template.json`), including cluster grouping
  (e.g. rigidity per body region) and per-field validation.
- **Live scoring**: total score across the DV_ORDINAL items 3.1–3.18
  (max. 132 points) is computed while filling in the form and shown with a
  severity classification.
- **Assessment history**: per-patient and global assessment lists; the
  detail view loads the saved composition from EHRbase and renders it
  according to the template structure.

## Project structure

```
src/
├── App.jsx, router.jsx          # Layout, routes, custom in-memory router
├── components/                   # Navbar, Sidebar, FormField
├── pages/
│   ├── PatientsPage.jsx           # Patient list + creation (incl. EHR creation)
│   ├── PatientDetails.jsx         # Patient + assessment history
│   ├── NewAssessmentPage.jsx      # Assessment form
│   ├── AssessmentsPage.jsx        # Global assessment list
│   └── AssessmentDetails.jsx      # Read-only view of a saved assessment
└── services/
    ├── ehrbase.js                 # EHRbase client (EHR, write/read composition)
    ├── patients.js, assessments.js # Client for local metadata (port 3000)
    ├── templateParser.js           # Web Template → form field model
    ├── scoreAqlPaths.js            # AQL paths of the scoring-relevant items
    ├── CompositionXmlBuilder.js    # builds the canonical XML composition
    └── template.json               # Web Template for UPDRS Part III

server.js                    # Express backend, port 3000
patients.json / assessments.json  # file-based local persistence
```

## Installation

```bash
npm install
npm install react-icons
npm install express cors
```

## Configuration

`.env` in the project root:

```env
VITE_EHRBASE_URL=https://<host>/ehrbase/rest/openehr/v1
VITE_TEMPLATE_ID=<template_id_in_ehrbase>
```

Requires a reachable EHRbase server with the
`openEHR-EHR-OBSERVATION.updrs_part_iii.v0` template deployed. The Express
server runs on a fixed port 3000 (hardcoded in
`src/services/patients.js`/`assessments.js`).

## Usage

```bash
npm run dev         # Terminal 1 – Vite dev server (localhost:5173)
node server.js     # Terminal 2 – local metadata backend
```


## openEHR details

- **Writing** uses **canonical XML** instead of FLAT
  (`CompositionXmlBuilder.js`): FLAT paths could not be reliably resolved
  against the deployed template; canonical XML follows the RM structure
  1:1.
- **Reading** uses the **FLAT format**, since it can be converted directly
  into a display structure without XML traversal
  (`templateParser.groupFlatComposition`).
- **Parts I, II, IV** are not populated — their SECTION/OBSERVATION nodes
  are optional per the template (`min = 0`) and currently contain no
  fields; they appear in the UI as empty tabs.

## Known limitations

- No authentication; the displayed clinician is static ("Dr. Test").
- Local persistence is file-based, not designed for multi-user production
  use.
- The Express port (3000) is hardcoded in the frontend instead of
  configurable.

## Stack

React 19 · Vite · Axios · react-icons · Express/CORS (local backend) ·
openEHR/EHRbase (REST) · Oxlint

---
*Parts of the implementation (e.g. the in-memory router, the EHRbase
client, and individual UI components) were created with the assistance of
Claude AI and subsequently reviewed and adapted.*
