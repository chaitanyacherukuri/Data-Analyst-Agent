"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Table, Brain } from "lucide-react";
import { useDropzone } from "react-dropzone";

export default function Home() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Check if we're running in development mode and enable some debug features
  const isDev = process.env.NODE_ENV === 'development';

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
      
      setIsUploading(true);
      setUploadError("");
      setDebugInfo(null);
      
      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        console.log("Uploading file:", file.name);
        console.log("File size:", file.size, "bytes");
        console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error(`Upload failed: ${response.status} ${response.statusText}. ${errorText}`);
        }
        
        const data = await response.json();
        console.log("Upload successful:", data);
        
        if (!data.session_id) {
          console.error("Missing session_id in response", data);
          setDebugInfo(`Response missing session_id: ${JSON.stringify(data, null, 2)}`);
          throw new Error('Missing session ID in server response');
        }
        
        // Add a small delay before navigation to ensure state updates
        setTimeout(() => {
          // First store the session ID in localStorage as a fallback
          localStorage.setItem('lastSessionId', data.session_id);
          
          // Try to navigate
          console.log(`Navigating to /analysis/${data.session_id}`);
          router.push(`/analysis/${data.session_id}`);
          
          // If we're still here after a moment, try a different approach
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              console.log("Using window.location for navigation");
              window.location.href = `/analysis/${data.session_id}`;
            }
          }, 500);
        }, 100);
        
      } catch (error: any) {
        console.error("Error uploading file:", error);
        setUploadError(`Error uploading file: ${error.message || 'Load failed'}. Please try again.`);
      } finally {
        setIsUploading(false);
      }
    },
  });

  // This useEffect will check if we have a last session ID and provide a recovery option
  useEffect(() => {
    const lastSessionId = localStorage.getItem('lastSessionId');
    if (lastSessionId) {
      setDebugInfo(`Previous upload detected. <a href="/analysis/${lastSessionId}" class="text-blue-600 underline">Continue to analysis</a>`);
    }
  }, []);

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
          
          {debugInfo && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-sm" dangerouslySetInnerHTML={{ __html: debugInfo }}></div>
          )}
        </div>
      </div>
    </main>
  );
} 