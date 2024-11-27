'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch user data or verify session
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user');
        if (!response.ok) {
          throw new Error('Unauthorized');
        }
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        // Redirect to login if unauthorized
        router.push('/login');
      }
    };

    fetchUserData();
  }, [router]);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <>
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl mb-4">Dashboard</h2>
        <p>Welcome, {user.email}</p>
        <button 
          onClick={handleLogout}
          className="mt-4 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
    </>);
}