// app/keyword-ranking-form.tsx
'use client';

import { useState } from 'react';
import axios from 'axios';

interface RankingResult {
  keyword: string;
  position: number | null;
  title?: string;
  link?: string;
  location?: string;
  country?: string;
  error?: string;
}

// Make props required instead of optional
export interface KeywordRankingFormProps {
  projectId: string;
  domain: string;
}

// Export the component with explicit prop typing
export function KeywordRankingForm(props: KeywordRankingFormProps) {
  const { projectId, domain } = props;
  const [url, setUrl] = useState(domain);
  const [keywords, setKeywords] = useState(['', '', '']);
  const [location, setLocation] = useState('Global');
  const [country, setCountry] = useState('Global');
  const [rankings, setRankings] = useState<RankingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  const checkRankings = async () => {
    if (!url || keywords.every(k => k.trim() === '')) {
      setError('Please enter a URL and at least one keyword');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRankings([]);

    try {
      const results = await Promise.all(
        keywords
          .filter(keyword => keyword.trim() !== '')
          .map(async (keyword) => {
            try {
              const response = await axios.get('/api/serp-ranking', {
                params: { 
                  keyword, 
                  url,
                  location,
                  country
                }
              });
              
              // Ensure we have a valid response
              if (response.data) {
                return response.data;
              }
              
              // If no valid response, return a structured error result
              return {
                keyword,
                position: null,
                location,
                country,
                error: 'Keyword not found in top 100 results'
              };
            } catch (error) {
              console.error(`Error checking ranking for ${keyword}:`, error);
              return {
                keyword,
                position: null,
                location,
                country,
                error: error instanceof Error ? error.message : 'An error occurred'
              };
            }
          })
      );

      setRankings(results.filter(result => result !== null));
    } catch (error) {
      setError('Failed to check rankings');
      console.error('Error checking rankings:', error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Keyword Ranking Checker</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="url">
          Website URL
        </label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter website URL (e.g., example.com)"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Location
        </label>
        <select 
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            if (e.target.value === 'Global') {
              setCountry('Global');
            } else if (e.target.value === 'United States') {
              setCountry('US');
            } else if (e.target.value === 'Nashville, TN') {
              setCountry('US');
            } else if (e.target.value === 'Lima, Peru') {
              setCountry('PE');
            }
          }}
          className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        >
          <option value="Global">Global</option>
          <option value="United States">United States</option>
          <option value="Nashville, TN">Nashville, TN</option>
          <option value="Lima, Peru">Lima, Peru</option>
        </select>
      </div>

      {keywords.map((keyword, index) => (
        <div key={index} className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Keyword {index + 1}
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(index, e.target.value)}
            placeholder={`Enter keyword ${index + 1}`}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          onClick={checkRankings}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
        >
          {isLoading ? 'Checking...' : 'Check Rankings'}
        </button>
      </div>

      {rankings.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Ranking Results</h3>
          <ul className="list-disc pl-5">
            {rankings.map((result, index) => {
              if (!result) return null;
              
              return (
                <li 
                  key={index} 
                  className={`mb-2 ${
                    result.error ? 'text-red-600' :
                    result.position ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {result.keyword} ({result.location || 'Global'}): {' '}
                  {result.error ? `Error: ${result.error}` :
                   result.position ? `Position ${result.position}` : 
                   'Not found in top 100 results'}
                  {result.title && result.position && (
                    <span className="block text-sm text-gray-500">
                      Title: {result.title}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}