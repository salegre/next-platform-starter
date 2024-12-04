'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PageLink {
  url: string;
  text: string;
  type: 'internal' | 'external';
}

interface PageDetails {
  url: string;
  title: string;
  status?: number;
  links: PageLink[];
  auditResults?: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    details?: string;
  }>;
}

export default function PageDetailsPage({ 
  params 
}: { 
  params: { id: string; pageUrl: string } 
}) {
  const [pageDetails, setPageDetails] = useState<PageDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchPageDetails = async () => {
      try {
        setIsLoading(true);
        // Use encodeURIComponent for the API fetch
        const response = await fetch(`/api/projects/${params.id}/pages/${encodeURIComponent(params.pageUrl)}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch page details');
        }
        
        const data = await response.json();
        console.log('Received page details:', data);
        setPageDetails(data);
      } catch (err) {
        console.error('Error fetching page details:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
  
    if (params.pageUrl) {
      console.log('Fetching details for URL:', params.pageUrl);
      fetchPageDetails();
    }
  }, [params.id, params.pageUrl]);

  if (isLoading) return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-lg text-gray-600">Loading page details...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="container mx-auto p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Page</h2>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Go Back
        </button>
      </div>
    </div>
  );
  if (!pageDetails) return <div>No page details found</div>;

  const internalLinks = pageDetails.links?.filter(link => link.type === 'internal') || [];
  const externalLinks = pageDetails.links?.filter(link => link.type === 'external') || [];

  return (
    <div className="container mx-auto p-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 mb-6 text-blue-500 hover:text-blue-600"
      >
        <ArrowLeft size={20} />
        Back to Project
      </button>

      <h1 className="text-2xl font-bold mb-6">{pageDetails.title || pageDetails.url}</h1>

      <div className="grid gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Page Information</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-gray-600">URL</dt>
              <dd className="mt-1">
                <a href={pageDetails.url} target="_blank" rel="noopener noreferrer" 
                   className="text-blue-500 hover:underline">{pageDetails.url}</a>
              </dd>
            </div>
            <div>
              <dt className="text-gray-600">Status Code</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 rounded ${
                  pageDetails.status === 200 ? 'bg-green-100 text-green-800' :
                  pageDetails.status >= 400 ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {pageDetails.status || 'Unknown'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Links */}
        {(internalLinks.length > 0 || externalLinks.length > 0) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {internalLinks.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Internal Links</h3>
                  <ul className="space-y-2">
                    {internalLinks.map((link, index) => (
                      <li key={index}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                           className="text-blue-500 hover:underline">
                          {link.text || link.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {externalLinks.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">External Links</h3>
                  <ul className="space-y-2">
                    {externalLinks.map((link, index) => (
                      <li key={index}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                           className="text-blue-500 hover:underline">
                          {link.text || link.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Results */}
        {pageDetails.auditResults && pageDetails.auditResults.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">SEO Audit Results</h2>
            <div className="space-y-3">
              {pageDetails.auditResults.map((result, index) => (
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}