'use client'; // This directive is crucial for client components

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { usePathname } from 'next/navigation'; // Use usePathname for App Router

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname(); // Get current path for conditional rendering (if needed)
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setProfileOpen(false); // Close profile dropdown
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link href="/">
          <span className="navbar-brand">Docu-Mind</span>
        </Link>
      </div>
      <div className="navbar-right">
        {isAuthenticated ? (
          <div className="profile-container">
            <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}>
              Profile
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <div className="dropdown-item">
                  <strong>Username:</strong> {user?.username}
                </div>
                <div className="dropdown-item">
                  <strong>Phone:</strong> {user?.phone_number}
                </div>
                <button onClick={handleLogout} className="dropdown-item logout-button">
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          // Only show Login/Register if not on those pages already
          <>
            {pathname !== '/login' && (
              <Link href="/login">
                <span className="navbar-link">Login</span>
              </Link>
            )}
            {pathname !== '/register' && (
              <Link href="/register">
                <span className="navbar-link">Register</span>
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}