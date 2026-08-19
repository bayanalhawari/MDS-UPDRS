/**
 * Sidebar.jsx
 * Left-hand navigation menu with the app's main sections. Highlights the
 * item matching the current route.
 */
 
import { useNavigate, useLocation } from "../router";
import { GoPeople } from "react-icons/go";
import { TfiFiles } from "react-icons/tfi";
import { VscNewFile } from "react-icons/vsc";


export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="sidebar">
      <ul className="menu">

        <li className={`menu-item ${location.pathname.startsWith("/patients") ? "active" : ""}`} onClick={() => navigate("/patients")}>
          <GoPeople className="icon" />
          Patients
        </li>

        <li className={`menu-item ${location.pathname.startsWith("/assessments") ? "active" : ""}`} onClick={() => navigate("/assessments")}>
          <TfiFiles className="icon" />
          Assessments
        </li>

        <li className={`menu-item ${location.pathname.startsWith("/new-assessment") ? "active" : ""}`} onClick={() => navigate("/new-assessment")}>
          <VscNewFile className="icon" />
          New Assessment
        </li>

      </ul>
    </div>
  );
}