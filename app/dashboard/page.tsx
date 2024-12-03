// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from 'components/card';
import { IProject } from 'models/Project';
import { IUser } from 'models/User';
import { ProjectCard } from 'components/project-card';

export default function DashboardPage() {
  const [user, setUser] = useState<IUser | null>(null);
  const [projects, setProjects] = useState<IProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [userResponse, projectsResponse] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/projects')
        ]);

        if (!userResponse.ok || !projectsResponse.ok) 
          throw new Error('Failed to fetch data');

        const [userData, projectsData] = await Promise.all([
          userResponse.json(),
          projectsResponse.json()
        ]);

        setUser(userData);
        setProjects(projectsData);
      } catch (error) {
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <main className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome, {user?.email}</p>
        </div>
        <button 
          onClick={() => router.push('/projects/new')}
          className="btn btn-primary"
        >
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard key={project._id.toString()} project={project} />
        ))}
      </div>
    </main>
  );
}