"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRight, FileUp, Table, Brain } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";

// Define file size threshold for showing detailed progress (5MB)
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB in bytes

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Removed unused state variables for lastSessionId and showSessionNotice
  const [uploadedSessionId, setUploadedSessionId] = useState<string | null>(null);
  // Add state for tracking upload progress
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'preparing' | 'uploading' | 'processing' | 'complete'>('preparing');
  // Track if the file is large enough to show detailed progress
  const [isLargeFile, setIsLargeFile] = useState(false);
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

    // Check if file is large enough to show detailed progress
    const showDetailedProgress = file.size >= LARGE_FILE_THRESHOLD;
    setIsLargeFile(showDetailedProgress);
    console.log(`File size: ${file.size} bytes. Show detailed progress: ${showDetailedProgress}`);

    // Immediately show the upload is starting
    setIsUploading(true);
    setUploadError("");
    setUploadedSessionId(null);
    setUploadProgress(0);
    setUploadStage('preparing');

    // Force a render to show the preparing state
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      console.log("Uploading file:", file.name, "Size:", file.size, "bytes");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://data-analyst-agent-production.up.railway.app';
      console.log("API URL:", apiUrl);

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // Use XMLHttpRequest instead of fetch to track progress
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Set up a timeout
        const timeoutId = setTimeout(() => {
          xhr.abort();
          reject(new Error('Request timed out. Please try again later.'));
        }, 120000); // 2 minutes timeout

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            console.log(`Upload progress: ${percentComplete}%`);
            setUploadProgress(percentComplete);
            setUploadStage('uploading');

            // When upload reaches 100%, show the success message immediately
            if (percentComplete === 100) {
              console.log('Upload complete, waiting for server processing');
              // We keep the stage as 'uploading' but with 100% progress
              // The UI will show a success message based on this state
            }
          } else {
            console.log('Upload progress event not computable');
            // Still show uploading state even if we can't compute percentage
            setUploadStage('uploading');
          }
        });

        // Add loadstart event to ensure we catch the beginning of the upload
        xhr.upload.addEventListener('loadstart', () => {
          console.log('Upload started');
          setUploadStage('uploading');
        });

        // Handle state changes
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) { // Request completed
            clearTimeout(timeoutId);

            if (xhr.status >= 200 && xhr.status < 300) {
              // Success
              try {
                setUploadStage('processing');
                const data = JSON.parse(xhr.responseText);
                console.log("Upload successful, received data:", data);

                if (!data.session_id) {
                  reject(new Error("Server response missing session ID. Please try again."));
                  return;
                }

                // Set stage to complete
                setUploadStage('complete');

                // Store session ID and trigger navigation
                localStorage.setItem('lastSessionId', data.session_id);
                setUploadedSessionId(data.session_id);
                resolve(data);
              } catch (parseError) {
                reject(new Error(`Error parsing server response: ${parseError.message}`));
              }
            } else {
              // Error
              let errorMessage = "";
              try {
                const errorData = JSON.parse(xhr.responseText);
                errorMessage = errorData.detail || `Server error: ${xhr.status}`;
              } catch (jsonError) {
                errorMessage = xhr.responseText || `Server error: ${xhr.status}`;
              }
              reject(new Error(`Upload failed: ${errorMessage}`));
            }
          }
        };

        // Handle network errors
        xhr.onerror = function() {
          clearTimeout(timeoutId);
          reject(new Error('Network error occurred. Please check your connection and try again.'));
        };

        // Open and send the request
        xhr.open('POST', `${apiUrl}/api/upload`, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send(formData);
      });

    } catch (error: any) {
      console.error("Error uploading file:", error);
      setUploadError(`Error uploading file: ${error.message || 'Upload failed'}. Please try again.`);
      // Reset upload state on error
      setUploadProgress(0);
      setUploadStage('preparing');
      setIsLargeFile(false);
      setIsUploading(false);
    }
    // Note: We don't set isUploading to false on success because we want to show the progress
    // until navigation happens
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
    <main className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-gradient-to-b from-slate-50 to-blue-50">
      {/* Header with gradient text - made more compact */}
      <div className="w-full max-w-6xl mb-6 md:mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 leading-tight pb-1 drop-shadow-sm">
          Data Analysis Agent
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mt-2">
          Upload your CSV file and get AI-powered insights from your data in seconds
        </p>
      </div>

      {/* Main content area with two columns on larger screens */}
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start">
        {/* Left column: Upload area - Prominent and visible without scrolling */}
        <div className="w-full lg:w-3/5 order-2 lg:order-1">
          <div className="sticky top-4">
            <div className="bg-white bg-opacity-70 backdrop-blur-sm p-4 rounded-lg shadow-sm mb-4">
              <h2 className="text-xl font-semibold text-blue-700 flex items-center">
                <FileUp className="h-5 w-5 mr-2" />
                Upload Your Data
              </h2>
              <p className="text-gray-600 text-sm">CSV files only. No file size limit.</p>
            </div>

            {/* Modern file upload area - Made more prominent */}
            <div
              {...getRootProps()}
              className={`p-8 border-3 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center transition-all duration-300 min-h-[250px] ${
                isDragActive
                  ? "border-blue-500 bg-blue-50 shadow-lg scale-[1.01]"
                  : "border-blue-300 hover:border-blue-400 bg-white hover:bg-blue-50/50 hover:shadow-md"
              }`}
            >
              <input {...getInputProps()} />
              <div className={`mb-6 p-6 rounded-full ${isDragActive ? 'bg-blue-100' : 'bg-blue-50'} transition-all duration-300`}>
                <FileUp className={`h-16 w-16 ${isDragActive ? 'text-blue-600' : 'text-blue-500'} transition-colors duration-300`} />
              </div>
              <p className="text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                {isDragActive
                  ? "Drop your CSV file here"
                  : "Drag and drop your CSV file here"}
              </p>
              <p className="text-base text-gray-600 mt-2">or <span className="text-blue-500 hover:text-blue-700 font-medium cursor-pointer">click to browse</span></p>
              <p className="text-sm text-gray-500 mt-4 flex items-center">
                <span className="inline-block w-1 h-1 rounded-full bg-gray-400 mr-2"></span>
                Only CSV files are supported
              </p>

              {/* Status indicators */}
              {isUploading && (
                <div className="mt-6 w-full max-w-md">
                  {/* For small files: Simple spinner */}
                  {!isLargeFile && (
                    <div className="flex items-center justify-center text-blue-600 bg-blue-50 p-3 rounded-lg">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2"></div>
                      <span>Uploading your file...</span>
                    </div>
                  )}

                  {/* For large files: Detailed progress bar */}
                  {isLargeFile && (
                    <>
                      {/* Progress bar container */}
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-medium text-blue-700">
                          {uploadStage === 'preparing' && 'Preparing upload...'}
                          {uploadStage === 'uploading' && `Uploading: ${uploadProgress}%`}
                          {uploadStage === 'processing' && 'Processing file...'}
                          {uploadStage === 'complete' && 'Upload complete!'}
                        </div>
                        <div className="text-xs text-blue-600">{uploadProgress}%</div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>

                      {/* Stage indicator */}
                      <div className="mt-2 flex justify-between text-xs text-gray-500">
                        <div className={`${uploadStage !== 'preparing' ? 'text-blue-600 font-medium' : ''}`}>Preparing</div>
                        <div className={`${uploadStage === 'uploading' || uploadStage === 'processing' || uploadStage === 'complete' ? 'text-blue-600 font-medium' : ''}`}>Uploading</div>
                        <div className={`${uploadStage === 'processing' || uploadStage === 'complete' ? 'text-blue-600 font-medium' : ''}`}>Processing</div>
                        <div className={`${uploadStage === 'complete' ? 'text-blue-600 font-medium' : ''}`}>Complete</div>
                      </div>

                      {/* Additional info based on stage */}
                      <div className="mt-3 text-center text-sm">
                        {uploadStage === 'preparing' && (
                          <div className="flex items-center justify-center text-blue-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                            Preparing your file for upload...
                          </div>
                        )}

                        {uploadStage === 'uploading' && uploadProgress < 100 && (
                          <div className="text-blue-600">
                            Uploading your file to the server...
                          </div>
                        )}

                        {uploadStage === 'uploading' && uploadProgress === 100 && (
                          <div className="text-green-600 bg-green-50 px-4 py-2 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Upload complete! Processing your data...
                          </div>
                        )}

                        {uploadStage === 'processing' && (
                          <div className="flex items-center justify-center text-blue-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                            Processing your data...
                          </div>
                        )}

                        {uploadStage === 'complete' && (
                          <div className="text-green-600 bg-green-50 px-4 py-2 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Upload successful! Redirecting to analysis...
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="mt-6 text-red-600 bg-red-50 px-4 py-3 rounded-lg shadow-sm">{uploadError}</div>
              )}

              {/* Only show this for small files or when not showing the detailed progress bar */}
              {uploadedSessionId && !isLargeFile && (
                <div className="mt-6 text-center">
                  <div className="text-green-600 bg-green-50 px-4 py-3 rounded-lg shadow-sm flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
        </div>

        {/* Right column: Feature cards - Now in a sidebar */}
        <div className="w-full lg:w-2/5 order-1 lg:order-2">
          <div className="bg-white bg-opacity-70 backdrop-blur-sm p-4 rounded-lg shadow-sm mb-4">
            <h2 className="text-xl font-semibold text-purple-700 flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              Features
            </h2>
            <p className="text-gray-600 text-sm">Powerful AI-driven data analysis</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="modern-card p-4 text-left flex items-start space-x-4">
              <div className="animated-icon-container p-2 rounded-full bg-blue-50">
                <FileUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Easy Upload</h3>
                <p className="text-gray-600 text-sm">
                  Simply drag and drop your CSV file to begin analyzing your data
                </p>
              </div>
            </div>

            <div className="modern-card p-4 text-left flex items-start space-x-4">
              <div className="animated-icon-container p-2 rounded-full" style={{background: 'linear-gradient(135deg, rgba(237, 233, 254, 0.8), rgba(237, 233, 254, 0.4))'}}>
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">AI Analysis</h3>
                <p className="text-gray-600 text-sm">
                  Our AI agent will analyze your data and provide valuable insights
                </p>
              </div>
            </div>

            <div className="modern-card p-4 text-left flex items-start space-x-4">
              <div className="animated-icon-container p-2 rounded-full" style={{background: 'linear-gradient(135deg, rgba(220, 252, 231, 0.8), rgba(220, 252, 231, 0.4))'}}>
                <Table className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Comprehensive Reports</h3>
                <p className="text-gray-600 text-sm">
                  Get detailed reports on your data structure, quality, and patterns
                </p>
              </div>
            </div>

            <div className="modern-card p-4 text-left flex items-start space-x-4">
              <div className="animated-icon-container p-2 rounded-full" style={{background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.8), rgba(254, 243, 199, 0.4))'}}>
                <ArrowRight className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Natural Language</h3>
                <p className="text-gray-600 text-sm">
                  Ask questions in plain English and get answers from your data
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full mt-8 text-center text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} Data Analysis Agent • AI-Powered Data Insights</p>
      </div>
    </main>
  );
}