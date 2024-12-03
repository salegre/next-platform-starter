import React, { useState } from 'react';
import { Card } from './card';

const parseCsvRankingData = (csvContent) => {
  // Split content into lines
  const lines = csvContent.split('\n')
    .filter(line => line.trim() && !line.startsWith('-----'));
  
  // Get the actual headers row (7th row, index 6)
  const headers = lines[6]?.split(',').map(h => h.trim()) || [];
  
  // Process data rows (starting immediately after headers row)
  const data = lines.slice(7).map((line, idx) => {
    const values = line.split(',').map(v => v.trim());
    const keyword = values[0];
    
    if (!keyword || keyword.includes('Report type') || keyword.includes('Period:')) {
      return null;
    }

    // Get the last three values for metrics (these are always at the end)
    const searchVolume = parseInt(values[values.length - 3]) || 0;
    const cpc = parseFloat(values[values.length - 2]) || 0;
    const difficulty = parseInt(values[values.length - 1]) || 0;

    // Process position history in sets of 3 columns
    const positionHistory = [];
    // Start from column 2 (after Keyword and Tag) and go until the metrics columns
    for (let i = 2; i < values.length - 3; i += 3) {
      const position = values[i];
      const type = values[i + 1];
      const landingPage = values[i + 2];

      // Only add if there's a valid position
      if (position && position !== '-') {
        // Get corresponding header for this position column
        const dateHeader = headers[i];
        const dateMatch = dateHeader.match(/_(\d{8})/);
        
        if (dateMatch) {
          const dateStr = dateMatch[1];
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          
          positionHistory.push({
            date: new Date(`${year}-${month}-${day}`),
            position: parseInt(position),
            type: type || '',
            landingPage: landingPage || ''
          });
        }
      }
    }

    const result = {
      keyword,
      searchVolume,
      cpc,
      difficulty,
      positionHistory: positionHistory.sort((a, b) => a.date.getTime() - b.date.getTime())
    };
    
    console.log(`Processed ${keyword}:`, {
      historyEntries: positionHistory.length,
      latestPosition: positionHistory.length > 0 ? positionHistory[positionHistory.length - 1].position : null,
      metrics: { searchVolume, cpc, difficulty }
    });
    
    return result;
  }).filter(item => item !== null);

  return data;
};

export default function CsvUploadComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [processedData, setProcessedData] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setUploadStatus('Processing file...');

    try {
      const content = await file.text();
      const data = parseCsvRankingData(content);
      setProcessedData(data);
      
      // Send to API
      const response = await fetch('/api/rankings/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankings: data })
      });

      if (!response.ok) {
        throw new Error('Failed to upload rankings');
      }

      const result = await response.json();
      setUploadStatus(`Successfully processed ${data.length} keywords. Modified: ${result.modified}, Upserted: ${result.upserted}`);

    } catch (error) {
      console.error('Error processing file:', error);
      setUploadStatus('Error processing file: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card title="" text="" linkText="" href="">
      <h2 className="text-xl font-bold mb-4">Upload Rankings CSV</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">CSV file with ranking data</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".csv" 
              onChange={handleFileUpload}
              disabled={isLoading}
            />
          </label>
        </div>

        {uploadStatus && (
          <div className={`p-4 rounded-lg ${uploadStatus.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {uploadStatus}
          </div>
        )}

        {processedData && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Processed Keywords ({processedData.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Search Volume</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPC</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">History Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position History</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {processedData.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.keyword}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.searchVolume.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.cpc.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.difficulty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.positionHistory.length > 0 
                          ? item.positionHistory[item.positionHistory.length - 1].position 
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.positionHistory.length}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.positionHistory.slice(-5).map((history, idx) => (
                          <div key={idx} className="text-xs">
                            {new Date(history.date).toLocaleDateString()}: {history.position} ({history.type})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}