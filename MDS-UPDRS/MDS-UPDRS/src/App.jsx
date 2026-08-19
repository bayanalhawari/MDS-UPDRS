/**
 * App.jsx
 * Application root: sets up the in-memory router and the overall page
 * layout (navbar, sidebar, content area), and declares all routes.
 */
import React, { useState } from "react";
import axios from "axios";
import { RouterProvider, Routes, Route } from "./router";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import PatientsPage from "./pages/PatientsPage";
import PatientDetails from "./pages/PatientDetails";
import NewAssessmentPage from "./pages/NewAssessmentPage";
import AssessmentDetailPage from "./pages/AssessmentDetails";
import AssessmentsPage from "./pages/AssessmentsPage";

export default function App() {
  return (
    <RouterProvider initialPath="/patients">
      <div className="app-layout">
        <Navbar />

        <div className="app-body">
          <Sidebar />

          <div className="content">
            <Routes>
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/:id" element={<PatientDetails />} />
              <Route path="/patients/:id/assessments/:assessmentId" element={<AssessmentDetailPage />} />
              <Route path="/assessments" element={<AssessmentsPage />} />
              <Route path="/new-assessment" element={<NewAssessmentPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </RouterProvider>
  );
}
