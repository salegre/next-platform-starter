'use client';

import { useState } from 'react';
import axios from 'axios';

interface RankingResult {
  keyword: string;
  position: number | null;
  title?: string;
  link?: string;
}

export function KeywordRankingForm() {
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState(['', '', '']);
  const [rankings, setRankings] = useState<RankingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  const checkRankings = async () => {
    if (!url || keywords.every(k => k.trim() === '')) {
      alert('Please enter a URL and at least one keyword');
      return;
    }

    setIsLoading(true);
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
                  url 
                }
              });
              return response.data;
            } catch (error) {
              console.error(`Error checking ranking for ${keyword}:`, error);
              return { 
                keyword, 
                position: null 
              };
            }
          })
      );

      setRankings(results);
    } catch (error) {
      console.error('Error checking rankings:', error);
      alert('Failed to check rankings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      <h2 className="text-xl font-bold mb-4">Keyword Ranking Checker</h2>
      
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

      {keywords.map((keyword, index) => (
        <div key={index} className="mb-4">
          <label 
            className="block text-gray-700 text-sm font-bold mb-2" 
            htmlFor={`keyword-${index}`}
          >
            Keyword {index + 1}
          </label>
          <input
            id={`keyword-${index}`}
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
            {rankings.map((result, index) => (
              <li 
                key={index} 
                className={`mb-2 ${
                  result.position ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {result.keyword}: {' '}
                {result.position ? 
                  `Position ${result.position}` : 
                  'Not found in top 100 results'}
                {result.title && result.position && (
                  <span className="block text-sm text-gray-500">
                    Title: {result.title}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}