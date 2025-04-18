"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRight, FileUp, Table, Brain } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Removed unused state variables for lastSessionId and showSessionNotice
  const [uploadedSessionId, setUploadedSessionId] = useState<string | null>(null);
  const router = useRouter();

  // We no longer need to check for previous sessions here
  // as _app.tsx handles automatic redirection

  // Handle navigation
  const navigateToAnalysis = useCallback((sessionId: string) => {
    try {
      console.log(`Attempting navigation to /analysis/${sessionId}`);
      // Force a hard navigation to ensure proper page load
      window.location.href = `/analysis/${sessionId}`;

      // Add a fallback in case the navigation doesn't trigger a page reload
      setTimeout(() => {
        console.log('Navigation may have failed - checking current URL');
        if (!window.location.pathname.includes(`/analysis/${sessionId}`)) {
          console.log('Still on the same page, trying alternative navigation');
          // Try an alternative approach
          window.location.replace(`/analysis/${sessionId}`);
        }
      }, 1000);
    } catch (error) {
      console.error('Navigation failed:', error);
      setUploadError('Navigation failed. Please try refreshing the page or go to /analysis/' + sessionId);
    }
  }, []);

  // Effect to handle navigation after successful upload
  useEffect(() => {
    if (uploadedSessionId) {
      console.log(`Upload successful with session ID: ${uploadedSessionId}, preparing navigation`);

      // Add a small delay to ensure state updates are complete
      const timer = setTimeout(() => {
        console.log('Delay complete, initiating navigation');
        navigateToAnalysis(uploadedSessionId);
      }, 300); // Increased delay for more reliability

      return () => {
        console.log('Clearing navigation timeout');
        clearTimeout(timer);
      };
    }
  }, [uploadedSessionId, navigateToAnalysis]);

  // Handle file upload
  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setUploadError("");
    setUploadedSessionId(null);

    try {
      console.log("Uploading file:", file.name, "Size:", file.size, "bytes");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://data-analyst-agent-production.up.railway.app';
      console.log("API URL:", apiUrl);

      const formData = new FormData();
      formData.append("file", file);

      const controller = new AbortController();
      // Increase timeout to 120 seconds (2 minutes) to handle larger files
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(`${apiUrl}/api/upload`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = "";
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || `Server error: ${response.status} ${response.statusText}`;
          } catch (jsonError) {
            const errorText = await response.text().catch(() => "Unknown error");
            errorMessage = errorText || `Server error: ${response.status} ${response.statusText}`;
          }
          throw new Error(`Upload failed: ${errorMessage}`);
        }

        const data = await response.json();
        console.log("Upload successful, received data:", data);

        if (!data.session_id) {
          throw new Error("Server response missing session ID. Please try again.");
        }

        // Store session ID and trigger navigation
        localStorage.setItem('lastSessionId', data.session_id);
        setUploadedSessionId(data.session_id);

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again later.');
        }
        throw fetchError;
      }

    } catch (error: any) {
      console.error("Error uploading file:", error);
      setUploadError(`Error uploading file: ${error.message || 'Upload failed'}. Please try again.`);
    } finally {
      setIsUploading(false);
    }
  }, []);

  // handleContinueToAnalysis removed as it's no longer needed

  // Dropzone setup
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    // Removed file size limit to allow larger CSV files
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      setUploadError(`Error: ${error?.message || 'Invalid file'}`);
      console.error('File rejection:', fileRejections);
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      await handleUpload(acceptedFiles[0]);
    },
  });

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-12 bg-gradient-to-b from-slate-50 to-blue-50">
      <div className="max-w-4xl w-full space-y-10">
        {/* Header with gradient text */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 leading-tight pb-1 drop-shadow-sm">
            Data Analysis Agent
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload your CSV file and get AI-powered insights from your data in seconds
          </p>
        </div>

        {/* Feature cards with hover effects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <div className="modern-card p-6 text-center flex flex-col items-center space-y-4">
            <div className="animated-icon-container mb-2">
              <FileUp className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold">Easy Upload</h2>
            <p className="text-gray-600">
              Simply drag and drop your CSV file to begin analyzing your data
            </p>
          </div>

          <div className="modern-card p-6 text-center flex flex-col items-center space-y-4">
            <div className="animated-icon-container mb-2" style={{background: 'linear-gradient(135deg, rgba(237, 233, 254, 0.8), rgba(237, 233, 254, 0.4))'}}>
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold">AI Analysis</h2>
            <p className="text-gray-600">
              Our AI agent will analyze your data and provide valuable insights
            </p>
          </div>

          <div className="modern-card p-6 text-center flex flex-col items-center space-y-4">
            <div className="animated-icon-container mb-2" style={{background: 'linear-gradient(135deg, rgba(220, 252, 231, 0.8), rgba(220, 252, 231, 0.4))'}}>
              <Table className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Comprehensive Reports</h2>
            <p className="text-gray-600">
              Get detailed reports on your data structure, quality, and patterns
            </p>
          </div>

          <div className="modern-card p-6 text-center flex flex-col items-center space-y-4">
            <div className="animated-icon-container mb-2" style={{background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.8), rgba(254, 243, 199, 0.4))'}}>
              <ArrowRight className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold">Natural Language</h2>
            <p className="text-gray-600">
              Ask questions in plain English and get answers from your data
            </p>
          </div>
        </div>

        {/* Modern file upload area */}
        <div
          {...getRootProps()}
          className={`mt-10 p-10 border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center transition-all duration-300 ${
            isDragActive
              ? "border-blue-400 bg-blue-50 shadow-md scale-[1.02]"
              : "border-gray-300 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md"
          }`}
        >
          <input {...getInputProps()} />
          <div className={`mb-6 p-4 rounded-full ${isDragActive ? 'bg-blue-100' : 'bg-blue-50'} transition-all duration-300`}>
            <FileUp className={`h-12 w-12 ${isDragActive ? 'text-blue-600' : 'text-blue-400'} transition-colors duration-300`} />
          </div>
          <p className="text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            {isDragActive
              ? "Drop your CSV file here"
              : "Drag and drop your CSV file here"}
          </p>
          <p className="text-base text-gray-500 mt-2">or <span className="text-blue-500 hover:text-blue-700 cursor-pointer">click to browse</span></p>
          <p className="text-sm text-gray-400 mt-4 flex items-center">
            <span className="inline-block w-1 h-1 rounded-full bg-gray-400 mr-2"></span>
            Only CSV files are supported
          </p>

          {/* Status indicators */}
          {isUploading && (
            <div className="mt-6 flex items-center text-blue-600 bg-blue-50 px-4 py-2 rounded-full">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
              Uploading your file...
            </div>
          )}

          {uploadError && (
            <div className="mt-6 text-red-600 bg-red-50 px-4 py-2 rounded-full">{uploadError}</div>
          )}

          {uploadedSessionId && (
            <div className="mt-6 text-center">
              <div className="text-green-600 bg-green-50 px-4 py-2 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Upload successful! Redirecting to analysis...
              </div>
              <div className="mt-3 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full mt-16 text-center text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} Data Analysis Agent • AI-Powered Data Insights</p>
      </div>
    </main>
  );
}