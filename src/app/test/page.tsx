'use client';

import { useState, useEffect } from 'react';

interface ConnectionTest {
  success: boolean;
  connection?: {
    database: string;
    user: string;
    current_time: string;
  };
  counts?: {
    firms: number;
    reportingPeriods: number;
  };
  error?: string;
}

export default function TestPage() {
  const [connectionTest, setConnectionTest] = useState<ConnectionTest | null>(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-connection');
      const data = await response.json();
      setConnectionTest(data);
    } catch {
      setConnectionTest({
        success: false,
        error: 'Failed to connect to API'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            FOS Complaints Tracker - Database Test
          </h1>
          <p className="text-gray-600 mt-2">
            Testing Neon PostgreSQL connection and data
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">Database Connection</span>
            <button 
              onClick={testConnection} 
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {connectionTest && (
            <div className="space-y-4">
              {connectionTest.success ? (
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-green-700 font-medium">Connected Successfully</span>
                  </div>
                  
                  {connectionTest.connection && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div><strong>Database:</strong> {connectionTest.connection.database}</div>
                      <div><strong>User:</strong> {connectionTest.connection.user}</div>
                      <div><strong>Time:</strong> {new Date(connectionTest.connection.current_time).toLocaleString()}</div>
                    </div>
                  )}

                  {connectionTest.counts && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-900 mb-2">Data Counts:</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {connectionTest.counts.firms?.toLocaleString() || '0'}
                          </div>
                          <div className="text-sm text-blue-700">Firms</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {connectionTest.counts.reportingPeriods?.toLocaleString() || '0'}
                          </div>
                          <div className="text-sm text-green-700">Reporting Periods</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-red-700 font-medium">Connection Failed</span>
                  </div>
                  {connectionTest.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <code className="text-red-800 text-sm">
                        {connectionTest.error}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
