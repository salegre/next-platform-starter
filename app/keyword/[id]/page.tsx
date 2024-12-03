'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Ranking {
  _id: string;
  keyword: string;
  url: string;
  position: number;
  title: string;
  linkUrl: string;
  location: string;
  country: string;
  positionHistory: {
    position: number;
    date: string;
  }[];
  createdAt: string;
}

export default function KeywordDetails({ params }: { params: { id: string } }) {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchRankingData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/rankings/${params.id}`);
      if (!res.ok) throw new Error('Failed to fetch ranking data');
      const data = await res.json();
      setRanking(data);
      setError(null);
    } catch (err) {
      setError('Failed to load ranking data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!ranking) return;

    try {
      setIsRefreshing(true);
      setError(null);

      const response = await fetch(`/api/serp-ranking?keyword=${encodeURIComponent(ranking.keyword)}&url=${encodeURIComponent(ranking.url)}&location=${encodeURIComponent(ranking.location)}&country=${encodeURIComponent(ranking.country)}`);

      if (!response.ok) {
        throw new Error('Failed to refresh ranking');
      }

      // Fetch updated data
      await fetchRankingData();
      
    } catch (err) {
      setError('Failed to refresh ranking data');
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRankingData();
  }, [params.id]);

  if (isLoading) return <div>Loading...</div>;
  if (!ranking) return <div>Ranking not found</div>;

  // Take the last 10 entries from position history
  const recentHistory = [...(ranking.positionHistory || [])]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6 text-gray-900">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{ranking.keyword}</h1>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Ranking
              </>
            )}
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Current Details</h2>
            <p><span className="font-medium">URL:</span> {ranking.url}</p>
            <p><span className="font-medium">Position:</span> {ranking.position}</p>
            <p><span className="font-medium">Location:</span> {ranking.location}</p>
            <p><span className="font-medium">Country:</span> {ranking.country}</p>
            <p><span className="font-medium">Tracked Since:</span> {new Date(ranking.createdAt).toLocaleDateString()}</p>
          </div>

          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Position History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Position</th>
                    <th className="px-4 py-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHistory.map((history, index) => {
                    const previousPosition = index < recentHistory.length - 1 
                      ? recentHistory[index + 1].position 
                      : null;
                    const change = previousPosition !== null 
                      ? previousPosition - history.position 
                      : null;
                    
                    return (
                      <tr key={history.date} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{new Date(history.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{history.position}</td>
                        <td className="px-4 py-2">
                          {change !== null && (
                            <span className={`${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {change > 0 ? `+${change}` : change}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}