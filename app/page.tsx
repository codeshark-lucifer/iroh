'use client';

import { useState } from 'react';

export default function Home() {
  const [videoId, setVideoId] = useState('dQw4w9WgXcQ');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = `/api/download?videoId=${videoId}`;
      
      // We use window.location.assign for direct attachment downloads
      window.location.assign(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Check console for details.');
    } finally {
      // Small timeout to reset loading state as the browser takes over the download
      setTimeout(() => setLoading(false), 2000);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-950 text-white">
      <div className="z-10 max-w-md w-full items-center justify-center font-mono text-sm border border-gray-800 p-8 rounded-xl bg-gray-900 shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-500">Video Downloader</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-2 text-xs uppercase tracking-widest">YouTube Video ID</label>
            <input 
              type="text" 
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. dQw4w9WgXcQ"
            />
          </div>

          <button 
            onClick={handleDownload}
            disabled={loading || !videoId}
            className={`w-full font-bold py-3 rounded mt-4 transition-all ${loading ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-400 text-white active:scale-95'}`}
          >
            {loading ? 'INITIALIZING...' : 'DOWNLOAD VIDEO'}
          </button>
        </div>

        <p className="mt-6 text-[10px] text-gray-500 text-center">
          Downloads highest quality available video format bypassing restricted metadata.
        </p>
      </div>
    </main>
  );
}
