"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, ArrowLeft, ChevronRight, Copy, CheckCheck, RefreshCw, Database, PieChart, ListFilter } from "lucide-react";

// Custom component for column lists
const ColumnList = ({ children }: { children: React.ReactNode }) => {
  return <div className="column-list">{children}</div>;
};

// Types
interface AnalysisQuestion {
  title: string;
  text: string;
}

interface PreviewData {
  preview: Record<string, any>[];
  columns: string[];
  filename: string;
}

export default function AnalysisPage() {
  const router = useRouter();
  const params = useParams();

  // Get sessionId from path params
  const sessionId = params.sessionId as string;

  // Ref for analysis results section
  const analysisResultsRef = useRef<HTMLDivElement>(null);

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [predefinedQuestions, setPredefinedQuestions] = useState<Record<string, string>>({});
  const [userQuestion, setUserQuestion] = useState("");
  const [analysisResults, setAnalysisResults] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Validate and store session ID
  useEffect(() => {
    if (!sessionId) {
      console.error('No session ID provided');
      setError("No session ID provided");
      setIsLoading(false);
      return;
    }

    console.log(`Analysis page: Using session ID ${sessionId}`);
    localStorage.setItem('lastSessionId', sessionId);

    // Fetch data immediately when sessionId is available
    fetchInitialData();
  }, [sessionId]);

  // Fetch data preview and predefined questions
  const fetchInitialData = useCallback(async () => {
    if (!sessionId) return;

    try {
      console.log(`Fetching data for session: ${sessionId}`);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://data-analyst-agent-production.up.railway.app';

      // Fetch session data
      console.log(`Fetching from: ${apiUrl}/api/sessions/${sessionId}`);
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch session data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Session data received:", data);
      setPreviewData(data);

      // Fetch predefined questions
      const questionsResponse = await fetch(`${apiUrl}/api/predefined-questions`, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!questionsResponse.ok) {
        throw new Error(`Failed to fetch predefined questions: ${questionsResponse.status}`);
      }

      const questionsData = await questionsResponse.json();
      console.log("Questions data received:", questionsData);
      setPredefinedQuestions(questionsData.questions);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setError("Failed to load data. Please try again or upload a new file.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Handle back navigation
  const handleBackClick = useCallback(async () => {
    try {
      await router.push('/');
    } catch (error) {
      console.error('Navigation error:', error);
      window.location.href = '/';
    }
  }, [router]);

  // Smooth scroll function
  const scrollToResults = useCallback(() => {
    if (analysisResultsRef.current) {
      // Wait a bit for the DOM to update
      setTimeout(() => {
        analysisResultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }, []);

  // Analyze data function
  const analyzeData = useCallback(async (question: string) => {
    if (!question || !sessionId) return;

    setIsAnalyzing(true);
    setAnalysisResults(null);
    setAnalysisError("");

    try {
      console.log(`Analyzing session ${sessionId} with question: ${question}`);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://data-analyst-agent-production.up.railway.app';

      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          question,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Analysis failed: ${response.status} ${response.statusText}`, errorText);

        // Handle specific error cases
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please wait a moment before trying again.");
        } else if (response.status === 502 || response.status === 504) {
          throw new Error("The server took too long to respond. This might happen with large files or complex questions.");
        } else if (response.status === 500) {
          // Try to parse the error message from the response
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error && errorData.error.includes("token limit")) {
              throw new Error("The AI model reached its token limit. Please try a simpler question or analyze a smaller dataset.");
            } else if (errorData.error && errorData.error.includes("rate limit")) {
              throw new Error("Rate limit exceeded. Please wait a moment before trying again.");
            } else {
              throw new Error(`Analysis failed: ${errorData.error || 'Server error'}`);
            }
          } catch (parseError) {
            // If we can't parse the error, use a generic message
            throw new Error(`Analysis failed: Server error (${response.status}). Please try again later.`);
          }
        } else {
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log("Analysis response:", data);

      // Check for error in the response data
      if (data.error) {
        throw new Error(data.error);
      }

      // Handle different response formats
      if (data.content) {
        setAnalysisResults(data.content);
      } else if (data.response) {
        setAnalysisResults(data.response);
      } else if (typeof data === 'string') {
        setAnalysisResults(data);
      } else {
        console.warn("Unexpected response format:", data);
        setAnalysisResults(JSON.stringify(data, null, 2));
      }

      // Reset retry count on success
      setRetryCount(0);
    } catch (error: any) {
      console.error("Analysis error:", error);

      // Set a more specific error message
      let errorMessage = "Failed to analyze data. Please try a different question.";

      if (error.message) {
        if (error.message.includes("token limit")) {
          errorMessage = "The AI model reached its token limit. Please try a simpler question or analyze a smaller dataset.";
        } else if (error.message.includes("rate limit")) {
          errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
        } else {
          errorMessage = error.message;
        }
      }

      setAnalysisError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId, scrollToResults, retryCount]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any previous errors
    setAnalysisError("");

    // Scroll to results section immediately
    scrollToResults();

    // Then start the analysis
    analyzeData(userQuestion);
  };

  // Handle predefined question click
  const handlePredefinedQuestion = (questionText: string) => {
    setUserQuestion(questionText);

    // Clear any previous errors
    setAnalysisError("");

    // Scroll to results section immediately
    scrollToResults();

    // Then start the analysis
    analyzeData(questionText);
  };

  // Copy results to clipboard
  const copyToClipboard = () => {
    if (analysisResults) {
      navigator.clipboard.writeText(analysisResults);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-blue-50">
        <div className="text-center p-8 rounded-xl bg-white/80 backdrop-blur-sm shadow-xl border border-blue-100">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-blue-200 opacity-20"></div>
            <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            <div className="absolute top-2 left-2 w-12 h-12 rounded-full border-4 border-t-purple-600 border-r-transparent border-b-transparent border-l-transparent animate-spin-slow"></div>
          </div>
          <p className="mt-6 text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Loading your data...</p>
          <p className="mt-2 text-gray-500">Preparing your analysis environment</p>
        </div>
      </div>
    );
  }

  if (error && !previewData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-blue-50">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg border border-red-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-6 p-3 bg-red-50 rounded-lg">{error}</p>
          <button
            onClick={handleBackClick}
            className="gradient-button"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Custom renderers for markdown components
  const MarkdownComponents = {
    // Custom table rendering
    table: (props: any) => (
      <div className="overflow-x-auto my-6 rounded-xl border border-gray-100 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" {...props} />
      </div>
    ),
    // Custom table header rendering
    thead: (props: any) => (
      <thead className="bg-gradient-to-r from-blue-50 to-purple-50" {...props} />
    ),
    // Custom table header cell rendering
    th: (props: any) => (
      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider" {...props} />
    ),
    // Custom table body rendering
    tbody: (props: any) => (
      <tbody className="bg-white divide-y divide-gray-100" {...props} />
    ),
    // Custom table cell rendering
    td: (props: any) => (
      <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-50" {...props} />
    ),
    // Custom inline code rendering for column names
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const isSQL = match && match[1].toLowerCase() === 'sql';
      const language = match ? match[1].toLowerCase() : '';
      const value = String(children).replace(/\n$/, '');

      // Check if it's an inline code that looks like a column name
      if (inline && /^[\w\d_.-]+$/.test(value)) {
        return (
          <span className="column-name">{value}</span>
        );
      }

      if (!inline && isSQL) {
        // SQL code block with special styling
        return (
          <div className="my-6 rounded-xl overflow-hidden shadow-md border border-indigo-100">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-white text-xs flex items-center">
              <Database className="h-4 w-4 mr-2" />
              <span>SQL Query</span>
            </div>
            <pre className="bg-slate-900 p-5 text-white overflow-x-auto">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }

      // Special styling for Python code
      if (!inline && language === 'python') {
        return (
          <div className="my-6 rounded-xl overflow-hidden shadow-md border border-green-100">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 px-4 py-2 text-white text-xs flex items-center">
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>Python Code</span>
            </div>
            <pre className="bg-slate-900 p-5 text-white overflow-x-auto">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }

      return inline ? (
        <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium" {...props}>
          {children}
        </code>
      ) : (
        <pre className="bg-gray-50 p-5 rounded-xl overflow-x-auto my-6 shadow-sm border border-gray-100">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },

    // Custom heading renderers
    h1: (props: any) => <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600" {...props} />,
    h2: (props: any) => <h2 className="text-xl font-bold mt-6 mb-4 pb-1 border-b border-gray-100 text-blue-700" {...props} />,
    h3: (props: any) => <h3 className="text-lg font-semibold mt-5 mb-3 text-indigo-700" {...props} />,
    h4: (props: any) => <h4 className="text-base font-semibold mt-4 mb-2 text-gray-800" {...props} />,
    // Custom paragraph with special handling for column lists
    p: (props: any) => {
      const content = props.children?.toString() || '';

      // Check if this paragraph contains a list of columns
      if (content.includes('Columns:')) {
        // Split the text at 'Columns:' to separate the prefix from the column list
        const parts = content.split('Columns:');
        if (parts.length === 2) {
          return (
            <p className="my-4 text-gray-700 leading-relaxed">
              {parts[0]}Columns:
              <ColumnList>
                {/* The rest of the content will be processed by the code renderer */}
              </ColumnList>
            </p>
          );
        }
      }

      return <p className="my-4 text-gray-700 leading-relaxed" {...props} />;
    },
    // Custom bullet lists
    ul: (props: any) => <ul className="my-4 ml-6 list-disc space-y-2" {...props} />,
    ol: (props: any) => <ol className="my-4 ml-6 list-decimal space-y-2" {...props} />,
    li: (props: any) => <li className="text-gray-700 pl-1" {...props} />,
    // Custom blockquote
    blockquote: (props: any) => <blockquote className="border-l-4 border-blue-200 pl-4 py-2 my-4 bg-blue-50/50 text-gray-700 italic rounded-r-md" {...props} />,
    // Custom strong
    strong: (props: any) => <strong className="font-semibold text-blue-800" {...props} />,
    // Custom emphasis
    em: (props: any) => <em className="text-gray-800 italic" {...props} />,
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-md sticky top-0 z-10 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackClick}
              className="p-2 rounded-full hover:bg-blue-50 transition-all duration-200 text-blue-600"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold truncate max-w-[300px] bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              {previewData?.filename || "Data Analysis"}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar with predefined questions */}
        <div className="lg:col-span-1">
          <div className="modern-card p-5 sticky top-24">
            <h2 className="font-semibold text-lg mb-4 flex items-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              <ListFilter className="h-5 w-5 mr-2 text-blue-600" />
              Quick Analysis
            </h2>
            <div className="space-y-2">
              {Object.entries(predefinedQuestions).map(([title, text]) => (
                <button
                  key={title}
                  onClick={() => handlePredefinedQuestion(text)}
                  className="w-full text-left p-3 rounded-lg hover:bg-blue-50 transition-all duration-200 flex items-center justify-between group border border-transparent hover:border-blue-100 hover:shadow-sm"
                >
                  <span className="font-medium text-gray-700 group-hover:text-blue-700">{title}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-4 space-y-6">
          {/* Data preview */}
          <div className="modern-card overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-blue-600" />
              <h2 className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Data Preview</h2>
            </div>
            <div className="p-4 overflow-x-auto">
              {previewData?.preview && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-50 to-purple-50">
                      {previewData.columns.map((column, i) => (
                        <th
                          key={i}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {previewData.preview.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={`transition-colors duration-150 ${rowIndex % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-gray-50/50 hover:bg-blue-50/30'}`}
                      >
                        {previewData.columns.map((column, colIndex) => (
                          <td
                            key={`${rowIndex}-${colIndex}`}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-600"
                          >
                            {row[column]?.toString() || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Question form */}
          <div className="modern-card">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 flex items-center">
              <svg className="h-5 w-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Ask a Question</h2>
            </div>
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    placeholder="E.g., What is the average age? Is there a correlation between age and income?"
                    className="modern-input pr-12"
                    disabled={isAnalyzing}
                  />
                  <button
                    type="submit"
                    disabled={!userQuestion || isAnalyzing}
                    className={`absolute right-3 top-3 p-2 rounded-full transition-all duration-200 ${!userQuestion || isAnalyzing ? 'text-gray-400' : 'text-blue-600 hover:text-white hover:bg-blue-600'}`}
                    aria-label="Send question"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Analysis results - Always render the container but conditionally show content */}
          <div ref={analysisResultsRef} className="modern-card">
            {(isAnalyzing || analysisResults || analysisError) && (
              <>
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 flex items-center justify-between">
                  <div className="flex items-center">
                    <Database className="h-5 w-5 mr-2 text-blue-600" />
                    <h2 className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Analysis Results</h2>
                  </div>
                  {analysisResults && !isAnalyzing && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => analyzeData(userQuestion)}
                        className="p-2 rounded-full text-blue-600 hover:bg-blue-100 transition-all duration-200 flex items-center"
                        title="Refresh analysis"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={copyToClipboard}
                        className="p-2 rounded-full text-blue-600 hover:bg-blue-100 transition-all duration-200 flex items-center"
                        title="Copy results"
                      >
                        {copiedToClipboard ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  {isAnalyzing && (
                    <div className="py-12 text-center">
                      <div className="relative mx-auto w-16 h-16">
                        <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-blue-200 opacity-20"></div>
                        <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                        <div className="absolute top-2 left-2 w-12 h-12 rounded-full border-4 border-t-purple-600 border-r-transparent border-b-transparent border-l-transparent animate-spin-slow"></div>
                      </div>
                      <p className="mt-6 text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Analyzing your data...</p>
                      <p className="mt-2 text-gray-500">Our AI is processing your question</p>
                    </div>
                  )}

                  {analysisError && !isAnalyzing && (
                    <div className="py-6 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">Analysis Error</h3>
                      <p className="text-red-600 mb-6 p-3 bg-red-50 rounded-lg max-w-2xl mx-auto">{analysisError}</p>
                      <div className="flex justify-center space-x-4">
                        <button
                          onClick={() => {
                            // Try the same question again
                            setRetryCount(prev => prev + 1);
                            analyzeData(userQuestion);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={() => {
                            // Clear the error and let user try a different question
                            setAnalysisError("");
                            setUserQuestion("");
                          }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Try a Different Question
                        </button>
                      </div>
                    </div>
                  )}

                  {analysisResults && !isAnalyzing && !analysisError && (
                    <div className="prose max-w-none">
                      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={MarkdownComponents}
                        >
                          {analysisResults}
                        </ReactMarkdown>
                      </div>
                      <div className="mt-6 flex justify-end">
                        <div className="text-xs text-gray-500 flex items-center">
                          <svg className="h-4 w-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Powered by AI analysis
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}