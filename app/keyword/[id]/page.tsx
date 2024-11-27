'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Ranking {
  _id: string;
  keyword: string;
  url: string;
  position: number;
  title: string;
  linkUrl: string;
  positionHistory: {
    position: number;
    date: string;
  }[];
  createdAt: string;
}

export default function KeywordDetails({ params }: { params: { id: string } }) {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/rankings/${params.id}`)
      .then(res => res.json())
      .then(data => setRanking(data))
      .catch(() => router.push('/dashboard'));
  }, [params.id, router]);

  if (!ranking) return <div>Loading...</div>;

  // Take the last 10 entries from position history
  const recentHistory = [...(ranking.positionHistory || [])]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6 text-gray-900">
        <h1 className="text-2xl font-bold mb-4">{ranking.keyword}</h1>
        <div className="grid gap-4">
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Current Details</h2>
            <p><span className="font-medium">URL:</span> {ranking.url}</p>
            <p><span className="font-medium">Position:</span> {ranking.position}</p>
            <p><span className="font-medium">Tracked Since:</span> {new Date(ranking.createdAt).toLocaleDateString()}</p>
          </div>

          <div className="border rounded p-4 overflow-x-auto">
            <h2 className="font-semibold mb-2">Position History</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Keyword</th>
                  {recentHistory.map((history, index) => (
                    <th key={index} className="px-4 py-2">
                      {new Date(history.date).toLocaleDateString()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{ranking.keyword}</td>
                  {recentHistory.map((history, index) => (
                    <td key={index} className="px-4 py-2 text-center">
                      {history.position}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}