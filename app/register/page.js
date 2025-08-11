'use client'; // This directive is crucial for client components

import React, { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Use next/navigation for App Router

const API_BASE_URL = 'http://localhost:8000';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    if (!username || !phoneNumber || !password) {
      setMessage('All fields are required.');
      setMessageType('error');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/register`, {
        username,
        phone_number: phoneNumber,
        password,
      });
      setMessage(response.data.message);
      setMessageType('success');
      // Redirect to login after successful registration
      setTimeout(() => router.push('/login'), 2000); 
    } catch (error) {
      console.error('Registration error:', error.response?.data || error);
      setMessage(error.response?.data?.error || 'Registration failed');
      setMessageType('error');
    }
  };

  return (
    <>
      {/* Title for App Router is typically handled in layout.js or page.js directly as <title> */}
      <title>Docu-Mind Register</title>

      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Register for Docu-Mind</h1>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="reg-username">Username:</label>
              <input
                type="text"
                id="reg-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="auth-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-phone">Phone Number:</label>
              <input
                type="tel" // Use type="tel" for phone numbers
                id="reg-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="auth-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">Password:</label>
              <input
                type="password"
                id="reg-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="auth-input"
              />
            </div>
            <button type="submit" className="auth-button">Register</button>
          </form>
          {message && (
            <div className={`auth-message ${messageType}`}>{message}</div>
          )}
          <p className="auth-switch">
            Already have an account? <Link href="/login">Login here</Link>
          </p>
        </div>
      </div>
    </>
  );
}