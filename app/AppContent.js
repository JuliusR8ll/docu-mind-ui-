// app/AppContent.jsx
'use client'; // This directive is CRUCIAL here to make it a client component

import { useAuth } from './context/AuthContext'; // <--- KEEP this import!
import Navbar from './components/Navbar'; // <--- KEEP this import!
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

// This component is now a Client Component
export function AppContent({ children }) {
  // This destructuring will now work because AuthProvider is a parent!
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Define routes that do NOT require authentication
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    // Redirect to login if not authenticated and trying to access a protected route
    if (!loading && !isAuthenticated && !isPublicRoute) {
      console.log('Redirecting to login: Not authenticated and not a public route.');
      router.push('/login');
    }
  }, [isAuthenticated, loading, isPublicRoute, router, pathname]);

  if (loading) {
    // Show a simple loading indicator while authentication status is being checked
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '24px' }}>
        Loading authentication...
      </div>
    );
  }

  // Render Navbar for all pages
  // Render children (the current page component)
  return (
    <>
      <Navbar /> {/* Navbar is rendered here */}
      {/* Only render content if authenticated OR it's a public route */}
      {(isAuthenticated || isPublicRoute) ? (
        children
      ) : (
        // This message will briefly show before redirection for protected routes
        <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
          Please log in to access this page. Redirecting...
        </div>
      )}
    </>
  );
}