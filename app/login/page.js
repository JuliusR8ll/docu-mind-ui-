'use client'; // This directive is crucial for client components

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    if (!username || !password) {
      setMessage('Please enter both username and password.');
      setMessageType('error');
      return;
    }

    // `login` function in AuthContext handles actual API call and redirection
    const result = await login(username, password);
    if (!result.success) {
      setMessage(result.message);
      setMessageType('error');
    }
  };

  return (
    <>
      {/* Title for App Router is typically handled in layout.js or page.js directly as <title> */}
      <title>Docu-Mind Login</title> 

      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Login to Docu-Mind</h1>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="auth-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="auth-input"
              />
            </div>
            <button type="submit" className="auth-button">Login</button>
          </form>
          {message && (
            <div className={`auth-message ${messageType}`}>{message}</div>
          )}
          <p className="auth-switch">
            Don't have an account? <Link href="/register">Register here</Link>
          </p>
        </div>
      </div>
    </>
  );
}