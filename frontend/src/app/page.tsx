"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRight, FileUp, Table, Brain } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [showSessionNotice, setShowSessionNotice] = useState(false);
  const [uploadedSessionId, setUploadedSessionId] = useState<string | null>(null);
  const router = useRouter();

  // Check localStorage for previous session on component mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem('lastSessionId');
    if (storedSessionId) {
      setLastSessionId(storedSessionId);
      setShowSessionNotice(true);
    }
  }, []);

  // Effect to handle navigation after successful upload
  useEffect(() => {
    let navigationTimeout: NodeJS.Timeout;

    if (uploadedSessionId) {
      console.log(`Preparing to navigate to /analysis/${uploadedSessionId}`);
      
      // Set a short delay to ensure state updates are complete
      navigationTimeout = setTimeout(() => {
        try {
          console.log('Executing navigation...');
          router.replace(`/analysis/${uploadedSessionId}`);
        } catch (error) {
          console.error('Navigation error:', error);
          // If router navigation fails, try direct navigation
          window.location.replace(`/analysis/${uploadedSessionId}`);
        }
      }, 100);
    }

    return () => {
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
  }, [uploadedSessionId, router]);

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
        
        // Trigger navigation by updating state
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

  // Handle continue to analysis click
  const handleContinueToAnalysis = useCallback((sessionId: string) => {
    console.log(`Handling continue to analysis for session ${sessionId}`);
    setUploadedSessionId(sessionId);
  }, []);

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

        {showSessionNotice && lastSessionId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between">
            <div className="mb-3 sm:mb-0">
              <p className="text-blue-700 font-medium">Previous upload detected</p>
              <p className="text-sm text-blue-600">You can continue with your previous analysis</p>
            </div>
            <button
              onClick={() => handleContinueToAnalysis(lastSessionId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Continue to Analysis
            </button>
          </div>
        )}

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
            <div className="mt-4 text-green-600">
              Upload successful! Redirecting to analysis...
              <button
                onClick={() => router.replace(`/analysis/${uploadedSessionId}`)}
                className="ml-2 text-blue-600 underline"
              >
                Click here if not redirected
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 