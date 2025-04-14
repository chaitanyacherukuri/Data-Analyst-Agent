"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, ArrowLeft, ChevronRight, ChevronDown, Copy, CheckCheck, RefreshCw, Database, PieChart, ListFilter } from "lucide-react";

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
  const sessionId = params.sessionId as string;

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [predefinedQuestions, setPredefinedQuestions] = useState<Record<string, string>>({});
  const [userQuestion, setUserQuestion] = useState("");
  const [analysisResults, setAnalysisResults] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Fetch data preview and predefined questions
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch session data
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch session data');
        }
        const data = await response.json();
        setPreviewData(data);

        // Fetch predefined questions
        const questionsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/predefined-questions`);
        if (!questionsResponse.ok) {
          throw new Error('Failed to fetch predefined questions');
        }
        const questionsData = await questionsResponse.json();
        setPredefinedQuestions(questionsData.questions);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setError("Failed to load data. Please try again or upload a new file.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [sessionId]);

  // Analyze data function
  const analyzeData = async (question: string) => {
    if (!question) return;

    setIsAnalyzing(true);
    setAnalysisResults(null);
    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          question,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze data');
      }
      
      const data = await response.json();
      setAnalysisResults(data.content);
    } catch (error) {
      console.error("Analysis error:", error);
      setError("Failed to analyze data. Please try a different question.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyzeData(userQuestion);
  };

  // Handle predefined question click
  const handlePredefinedQuestion = (questionText: string) => {
    setUserQuestion(questionText);
    analyzeData(questionText);
  };

  // Back to home
  const handleBackToHome = () => {
    router.push("/");
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error && !previewData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleBackToHome}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
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
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200" {...props} />
      </div>
    ),
    // Custom table header rendering
    thead: (props: any) => (
      <thead className="bg-gray-100" {...props} />
    ),
    // Custom table header cell rendering
    th: (props: any) => (
      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />
    ),
    // Custom table body rendering
    tbody: (props: any) => (
      <tbody className="bg-white divide-y divide-gray-200" {...props} />
    ),
    // Custom table cell rendering
    td: (props: any) => (
      <td className="px-4 py-3 text-sm text-gray-500" {...props} />
    ),
    // Custom code block rendering
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const isSQL = match && match[1].toLowerCase() === 'sql';
      
      if (!inline && isSQL) {
        // SQL code block with special styling
        return (
          <div className="my-4 rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 text-white text-xs flex items-center">
              <Database className="h-4 w-4 mr-2" />
              <span>SQL Query</span>
            </div>
            <pre className="bg-slate-900 p-4 text-white overflow-x-auto">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }
      
      return inline ? (
        <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded" {...props}>
          {children}
        </code>
      ) : (
        <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto my-4">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    // Custom heading renderers
    h1: (props: any) => <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200" {...props} />,
    h2: (props: any) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
    h3: (props: any) => <h3 className="text-lg font-bold mt-4 mb-2" {...props} />,
    // Custom paragraph
    p: (props: any) => <p className="my-3 text-gray-700 leading-relaxed" {...props} />,
    // Custom bullet lists
    ul: (props: any) => <ul className="my-3 ml-6 list-disc space-y-1" {...props} />,
    ol: (props: any) => <ol className="my-3 ml-6 list-decimal space-y-1" {...props} />,
    li: (props: any) => <li className="text-gray-700" {...props} />,
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToHome}
              className="p-2 rounded-full hover:bg-gray-100 transition"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold truncate max-w-[300px]">
              {previewData?.filename || "Data Analysis"}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar with predefined questions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-24">
            <h2 className="font-semibold text-lg mb-4 flex items-center">
              <ListFilter className="h-5 w-5 mr-2 text-blue-600" />
              Quick Analysis
            </h2>
            <div className="space-y-2">
              {Object.entries(predefinedQuestions).map(([title, text]) => (
                <button
                  key={title}
                  onClick={() => handlePredefinedQuestion(text)}
                  className="w-full text-left p-3 rounded-md hover:bg-blue-50 transition flex items-center justify-between group"
                >
                  <span className="font-medium text-gray-700 group-hover:text-blue-700">{title}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-4 space-y-6">
          {/* Data preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-blue-600" />
              <h2 className="font-semibold text-lg">Data Preview</h2>
            </div>
            <div className="p-4 overflow-x-auto">
              {previewData?.preview && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewData.columns.map((column, i) => (
                        <th
                          key={i}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.preview.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {previewData.columns.map((column, colIndex) => (
                          <td
                            key={`${rowIndex}-${colIndex}`}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-lg">Ask a Question</h2>
            </div>
            <div className="p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    placeholder="E.g., What is the average age? Is there a correlation between age and income?"
                    className="w-full p-3 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isAnalyzing}
                  />
                  <button
                    type="submit"
                    disabled={!userQuestion || isAnalyzing}
                    className="absolute right-2 top-2 p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 transition"
                    aria-label="Send question"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Analysis results */}
          {(isAnalyzing || analysisResults) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-blue-600" />
                  <h2 className="font-semibold text-lg">Analysis Results</h2>
                </div>
                {analysisResults && !isAnalyzing && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => analyzeData(userQuestion)}
                      className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition flex items-center"
                      title="Refresh analysis"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition flex items-center"
                      title="Copy results"
                    >
                      {copiedToClipboard ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                {isAnalyzing && (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Analyzing your data...</p>
                  </div>
                )}
                
                {analysisResults && !isAnalyzing && (
                  <div className="prose max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={MarkdownComponents}
                    >
                      {analysisResults}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 