'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  email: string;
}

interface Ranking {
  _id: string;
  keyword: string;
  url: string;
  linkUrl: string;
  position: number | null;
  createdAt: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [userResponse, rankingsResponse] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/rankings')
        ]);

        if (!userResponse.ok || !rankingsResponse.ok) throw new Error('Failed to fetch data');

        const [userData, rankingsData] = await Promise.all([
          userResponse.json(),
          rankingsResponse.json()
        ]);

        setUser(userData);
        setRankings(rankingsData);
      } catch (error) {
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (isLoading) return <><div>Loading...</div></>;

  return (
    <>
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome, {user?.email}</p>
        </div>
        <button 
          onClick={() => fetch('/api/logout', { method: 'POST' }).then(() => router.push('/login'))}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Your Rankings</h2>
        {rankings.length === 0 ? (
          <p>No keywords tracked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracked Since</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rankings.map((ranking) => (
                  <tr key={ranking._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">  <Link href={`/keyword/${ranking._id}`} className="text-blue-500 hover:underline">
    {ranking.keyword}
  </Link></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500">
                      <a 
                        href={ranking.linkUrl || ranking.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {ranking.url}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ranking.position ?? 'Pending'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ranking.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
        )}
      </div>
      
    </div>
    </>
  );
}