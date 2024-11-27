'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from 'components/card';
import { IRanking } from 'models/Ranking';
import { IUser } from 'models/User';
import { RankingsTable } from '@/components/rankings-table';

export default function Page() {
  const [user, setUser] = useState<IUser | null>(null);
  const [rankings, setRankings] = useState<IRanking[]>([]);
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

  if (isLoading) return (
    <Card 
      title="Loading..." 
      text=""
      linkText=""
      href=""
    > </Card>
  );

  return (
    <main className="container mx-auto p-6">
      <section className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-600">Welcome, {user?.email}</p>
          </div>
          <button 
            onClick={() => fetch('/api/logout', { method: 'POST' }).then(() => router.push('/login'))}
            className="btn btn-error"
          >
            Logout
          </button>
        </div>

        <Card 
          title="Your Rankings"
          text="" 
          linkText=""
          href=""
          >
        {rankings.length === 0 ? (
          <p>No keywords tracked yet.</p>
        ) : (
          <RankingsTable rankings={rankings} />
        )}
        </Card>
      </section>
    </main>
  );
}