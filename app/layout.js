// app/layout.js

// This part (metadata and RootLayout function) will be a Server Component
// It does NOT have 'use client'; at the top.
// This allows it to export metadata.

import './globals.css'; // Your global styles
import { AuthProvider } from './context/AuthContext'; // <--- Keep this import!
// import Navbar from './components/Navbar'; // <--- REMOVE THIS line (Navbar is rendered inside AppContent)
import { AppContent } from './AppContent'; // Corrected import path from previous step

// Define metadata for the app. This is a Server Component feature.
export const metadata = {
  title: 'Docu-Mind',
  description: 'Chat with your documents using Groq AI',
};

// This RootLayout is now a Server Component
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/*
          CRUCIAL FIX: AuthProvider MUST wrap AppContent.
          This ensures that when AppContent calls useAuth(), the context is already provided.
        */}
        <AuthProvider>
          <AppContent>{children}</AppContent>
        </AuthProvider>
      </body>
    </html>
  );
}