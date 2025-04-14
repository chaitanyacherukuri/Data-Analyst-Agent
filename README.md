# Data Analysis Agent

A full-stack web application for AI-powered data analysis. This application allows users to upload CSV files and use an AI agent to analyze the data through natural language questions.

## Tech Stack

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- React Query
- Chart.js/React-chartjs-2
- Axios

### Backend
- FastAPI
- Agno framework
- Groq API (Llama 4 Model)
- DuckDB
- Pandas

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker and Docker Compose (optional, for containerized deployment)
- Groq API key

## Setup

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here

# Backend Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Running with Docker

```bash
docker-compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Deployment Options

### Vercel (Frontend)
1. Push your code to GitHub
2. Import the repository in Vercel dashboard
3. Configure environment variables
4. Deploy

### Railway.app (Backend)
1. Push your code to GitHub
2. Import the repository in Railway dashboard
3. Configure environment variables
4. Deploy

## Features

- CSV file upload and preview
- Natural language data analysis
- Predefined analysis questions
- Interactive visualization
- Session management

## License

MIT 