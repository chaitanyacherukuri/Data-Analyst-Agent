/**
 * API client for communicating with the backend
 */
const apiClient = {
  /**
   * Base URL for API requests, defaults to localhost in development
   */
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',

  /**
   * Generic fetch wrapper with error handling
   */
  async fetch<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Request failed with status ${response.status}`);
    }

    return response.json();
  },

  /**
   * Upload a file to the backend
   */
  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Upload failed with status ${response.status}`);
    }

    return response.json();
  },

  /**
   * Analyze data with a question
   */
  async analyzeData(sessionId: string, question: string): Promise<any> {
    return this.fetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        question,
      }),
    });
  },

  /**
   * Get session data including file preview
   */
  async getSession(sessionId: string): Promise<any> {
    return this.fetch(`/api/sessions/${sessionId}`);
  },

  /**
   * Get predefined analysis questions
   */
  async getPredefinedQuestions(): Promise<any> {
    return this.fetch('/api/predefined-questions');
  },
};

export default apiClient; 