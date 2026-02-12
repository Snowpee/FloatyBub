import React, { useState } from 'react';
import { executeVisitPage } from '@/tools';
import { getApiBaseUrl } from '@/lib/utils';

const FetchTestPage: React.FC = () => {
  const [url, setUrl] = useState('https://www.example.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [rawFetchResult, setRawFetchResult] = useState<any>(null);

  const handleTestExecute = async () => {
    setLoading(true);
    setResult('');
    setError('');
    setRawFetchResult(null);

    try {
      const output = await executeVisitPage(url);
      setResult(output);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTestRawFetch = async () => {
    setLoading(true);
    setResult('');
    setError('');
    setRawFetchResult(null);

    try {
      const apiBaseUrl = getApiBaseUrl();
      const params = new URLSearchParams();
      params.set('url', url);
      
      const visitUrl = `${apiBaseUrl}/api/visit-page?${params.toString()}`;
      
      console.log('Testing raw fetch to:', visitUrl);
      
      const res = await fetch(visitUrl, {
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        }
      });
      
      const status = res.status;
      const statusText = res.statusText;
      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = await res.text();
      }

      setRawFetchResult({
        status,
        statusText,
        data
      });

    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Fetch / Visit Page Test</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Target URL</label>
          <input 
            type="text" 
            value={url} 
            onChange={e => setUrl(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="https://..."
          />
        </div>

        <div className="flex space-x-4">
          <button 
            onClick={handleTestExecute}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test executeVisitPage()'}
          </button>

          <button 
            onClick={handleTestRawFetch}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Raw Fetch'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Results</h2>
        
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded border border-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <h3 className="font-medium">executeVisitPage Output:</h3>
            <pre className="p-4 bg-gray-100 rounded overflow-auto max-h-96 text-sm whitespace-pre-wrap">
              {result}
            </pre>
          </div>
        )}

        {rawFetchResult && (
          <div className="space-y-2">
            <h3 className="font-medium">Raw Fetch Output:</h3>
            <div className="p-4 bg-gray-100 rounded overflow-auto max-h-96 text-sm">
              <div><strong>Status:</strong> {rawFetchResult.status} {rawFetchResult.statusText}</div>
              <pre className="mt-2 whitespace-pre-wrap">
                {typeof rawFetchResult.data === 'string' 
                  ? rawFetchResult.data 
                  : JSON.stringify(rawFetchResult.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FetchTestPage;
