/**
 * Navbar.jsx
 * Top navigation bar: app name, live clock, notification icon, current
 * clinician, and a sign-out button.
 */
import { useEffect, useState } from 'react';
import { VscBellDot } from "react-icons/vsc";
import { PiSignOutLight } from "react-icons/pi";
import { IoPersonCircleOutline } from "react-icons/io5";

// The logged-in clinician shown in the navbar. Fixed for now — there is no
// login/auth flow in this app yet, so every session is "Dr. Test".
const CURRENT_CLINICIAN = { name: 'Dr. Test', role: 'Clinician' };

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function formatTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(d) {
  return d
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/,/g, '')
    .toUpperCase();
}

export default function Navbar() {
  const now = useClock();

  return (
    <header className="navbar">
      <div className="navbar__brand" >
        <span className="navbar__brand-text">
          <span className="navbar__brand-name">MDS-UPDRS</span>
        </span>
      </div>

      <div className="navbar__right">
        <div className="navbar__clock">
          <span className="navbar__time">{formatTime(now)}</span>
          <span className="navbar__date">{formatDate(now)}</span>
        </div>

        <button type="button" className="navbar__icon-btn" >
          <  VscBellDot />
        </button>

        <div className="navbar__user">
          <span className="navbar__avatar" >
            <IoPersonCircleOutline/> 
          </span>
          <span className="navbar__user-text">
            <span className="navbar__user-name">{CURRENT_CLINICIAN.name}</span>
            <span className="navbar__user-role">{CURRENT_CLINICIAN.role.toUpperCase()}</span>
          </span>
        </div>

        <button type="button" className="navbar__signout">
          <PiSignOutLight />
          Sign out
        </button>
      </div>
    </header>
  );
}