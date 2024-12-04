'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeywordRankingForm } from '@/app/keyword-ranking-form';
import { RankingsTable } from '@/components/rankings-table';
import SiteStructure from '@/components/site-structure';
import { IProject, IAuditResult } from 'models/Project';
import { IRanking } from 'models/Ranking';

interface ProjectData {
  project: IProject;
  rankings: IRanking[];
}



export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handlePageClick = (pageUrl: string) => {
    // Single encode is sufficient
    const encodedUrl = encodeURIComponent(pageUrl);
    console.log('Navigating to:', encodedUrl);
    router.push(`/projects/${params.id}/pages/${encodedUrl}`);
  };

  const fetchProjectData = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch project data');
      const projectData = await response.json();
      setData(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [params.id]);

  const handleAudit = async () => {
    setIsAuditing(true);
    try {
      const response = await fetch(`/api/projects/${params.id}/audit`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to perform audit');
      await fetchProjectData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCrawl = async () => {
    setIsCrawling(true);
    try {
      const response = await fetch(`/api/projects/${params.id}/structure`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to analyze site structure');
      const result = await response.json();
      if (result.success) {
        await fetchProjectData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCrawling(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No project found</div>;

  const { project, rankings } = data;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
            <p className="text-gray-600">{project.domain}</p>
            {project.description && (
              <p className="text-gray-500 mt-2">{project.description}</p>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleCrawl}
              disabled={isCrawling}
              className="btn btn-secondary"
            >
              {isCrawling ? 'Crawling Site...' : 'Crawl Site'}
            </button>
            <button
              onClick={handleAudit}
              disabled={isAuditing}
              className="btn btn-primary"
            >
              {isAuditing ? 'Running Audit...' : 'Run SEO Audit'}
            </button>
          </div>
        </div>
      </div>

      {/* Site Structure */}
      {project.siteStructure && (
        <div className="mb-8">
            <SiteStructure 
            structure={project.siteStructure}
            pages={project.pages || []}
            auditResults={project.auditResults || []}  // Pass the array directly
            onPageClick={handlePageClick}
            />
        </div>
        )}


      {/* SEO Audit Results */}
      {project.auditResults && project.auditResults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Latest SEO Audit Results</h2>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="mb-2 text-sm text-gray-500">
              Last audit: {new Date(project.lastAuditDate!).toLocaleString()}
            </div>
            <div className="space-y-3">
              {project.auditResults.map((result: IAuditResult, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg ${
                    result.severity === 'error' ? 'bg-red-50 text-red-700' :
                    result.severity === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-blue-50 text-blue-700'
                  }`}
                >
                  <div className="font-medium">{result.message}</div>
                  {result.details && (
                    <div className="text-sm mt-1">{result.details}</div>
                  )}
                  {result.url && (
                    <div className="text-sm mt-1">
                      URL: <a href={result.url} target="_blank" rel="noopener noreferrer" 
                           className="underline">{result.url}</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyword Rankings */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Keyword Rankings</h2>
        {rankings.length > 0 ? (
          <RankingsTable rankings={rankings} />
        ) : (
          <p className="text-gray-500">No keywords tracked yet.</p>
        )}
      </div>

      {/* Add New Keyword Form */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Track New Keyword</h2>
        <KeywordRankingForm 
          projectId={params.id}
          domain={project.domain}
        />
      </div>
    </div>
  );
}