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
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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
    maxSize: 5 * 1024 * 1024, // 5MB max file size
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        setUploadError('File is too large. Maximum size is 5MB.');
      } else {
        setUploadError(`Error: ${error?.message || 'Invalid file'}`);
      }
      console.error('File rejection:', fileRejections);
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      await handleUpload(acceptedFiles[0]);
    },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-slate-50">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Data Analysis Agent
          </h1>
          <p className="text-lg text-gray-600">
            Upload your CSV file and get AI-powered insights from your data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center flex flex-col items-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FileUp className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold">Easy Upload</h2>
            <p className="text-gray-600">
              Simply drag and drop your CSV file to begin analyzing your data
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center flex flex-col items-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold">AI Analysis</h2>
            <p className="text-gray-600">
              Our AI agent will analyze your data and provide valuable insights
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center flex flex-col items-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Table className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Comprehensive Reports</h2>
            <p className="text-gray-600">
              Get detailed reports on your data structure, quality, and patterns
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center flex flex-col items-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold">Natural Language</h2>
            <p className="text-gray-600">
              Ask questions in plain English and get answers from your data
            </p>
          </div>
        </div>

        {/* Previous session notification removed - automatic redirection handled in _app.tsx */}

        <div
          {...getRootProps()}
          className={`mt-8 p-8 border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center transition-colors ${
            isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
          }`}
        >
          <input {...getInputProps()} />
          <FileUp className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium">
            {isDragActive
              ? "Drop your CSV file here"
              : "Drag and drop your CSV file here, or click to browse"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Only CSV files are supported</p>

          {isUploading && (
            <div className="mt-4 text-blue-600">Uploading your file...</div>
          )}

          {uploadError && (
            <div className="mt-4 text-red-600">{uploadError}</div>
          )}

          {uploadedSessionId && (
            <div className="mt-4 text-center">
              <p className="text-green-600 mb-2">Upload successful! Redirecting to analysis...</p>
              <div className="mt-2 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}