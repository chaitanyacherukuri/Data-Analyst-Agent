from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pandas as pd
import os
import uuid
import shutil
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

from agno.agent import Agent
from agno.models.groq import Groq
from agno.tools.duckdb import DuckDbTools

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Check for required environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is not set. Please add it to your .env file.")

app = FastAPI(title="Data Analysis API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create temp directory
os.makedirs("temp", exist_ok=True)

# Session store (in production, use Redis or a database)
sessions = {}

class AnalysisRequest(BaseModel):
    session_id: str
    question: str

class SessionData(BaseModel):
    file_path: str
    file_name: str
    created_at: datetime

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a CSV file and create a new analysis session"""
    # Better error checking for file
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    print(f"Received file upload: {file.filename}")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    # Generate session ID and save file
    session_id = str(uuid.uuid4())
    file_path = f"temp/{session_id}_{file.filename}"
    
    try:
        # Ensure temp directory exists
        os.makedirs("temp", exist_ok=True)
        
        # Save file content
        print(f"Saving file to {file_path}")
        contents = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        # Reset file cursor for potential reuse
        await file.seek(0)
    except Exception as e:
        print(f"Error saving file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
    
    # Store session information
    sessions[session_id] = SessionData(
        file_path=file_path,
        file_name=file.filename,
        created_at=datetime.now()
    )
    
    # Read file preview
    try:
        print(f"Parsing CSV file: {file_path}")
        df = pd.read_csv(file_path)
        preview = df.head(5).to_dict(orient="records")
        columns = list(df.columns)
        print(f"Successfully parsed CSV with {len(df)} rows, {len(columns)} columns")
    except Exception as e:
        print(f"Error reading CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading CSV: {str(e)}")
    
    response_data = {
        "session_id": session_id,
        "filename": file.filename,
        "preview": preview,
        "columns": columns
    }
    print(f"Upload successful. Session ID: {session_id}")
    return response_data

def get_agent(file_path: str):
    """Initialize DuckDB tools and Agno agent"""
    duckdb_tools = DuckDbTools(
        create_tables=True,
        summarize_tables=True,
        export_tables=False
    )
    
    # Load data into DuckDB
    duckdb_tools.load_local_csv_to_table(
        path=file_path,
        table="uploaded_data"
    )
    
    # Initialize the agent with Groq
    try:
        agent = Agent(
            model=Groq(
                id="meta-llama/llama-4-scout-17b-16e-instruct",
                temperature=0.1,
                max_tokens=4000,
                api_key=GROQ_API_KEY
            ),
            description="You are a SQL expert data analyst who specializes in performing data analysis using DuckDB queries on real data.",
            instructions=[
                # Initial data examination
                "Always begin by examining the actual data structure with 'DESCRIBE uploaded_data' or 'SELECT * FROM uploaded_data LIMIT 5'",
                "List the actual column names from the uploaded_data table before writing any analysis queries",
                "Always use the actual column names from the uploaded_data table in your queries",  

                # Execution instructions
                "ALWAYS execute your SQL queries using the run_sql_query tool - never just show a query without executing it",
                "After generating a SQL query, immediately execute it and show the results",
                "Never present SQL queries as the final answer - the results of executing the queries are the answer",
                "For each analysis step: (1) Write the SQL query, (2) Execute it with the run_sql_query tool, (3) Explain the results",
                "If the user's question requires SQL analysis, you must execute at least one SQL query before giving your final answer",

                # Loop prevention instructions
                "If a SQL query fails, DO NOT retry the exact same query - modify the approach or column names",
                "Never attempt the same SQL query more than twice - if it fails, try a completely different approach",
                "Start with simple queries and gradually add complexity only if needed",
                "If a query fails due to column names, immediately verify columns with 'PRAGMA table_info(uploaded_data)'",
                "When stuck, simplify the query rather than retrying",
                    
                # Query Optimization
                "Use LIMIT clauses in all exploratory queries",
                "Break complex queries into simpler steps using WITH clauses",
                "Avoid nested subqueries when possible - use CTEs (WITH clause) instead",
                "Include clear error handling in complex calculations",

                # Prevent hallucination
                "Never create fictional example data - only analyze the actual data in the uploaded_data table",
                "If you're uncertain about column names or data types, verify them first with a query",
                "If you cannot answer a question with the available data, state clearly what's missing rather than making up results",
                "Do not assume data structures or values that aren't present in the actual uploaded_data table",
                    
                # Query validation
                "Test your SQL queries on small subsets of data before running complex analyses",
                "If a query fails, show the error and try a simpler alternative that works with the actual columns",
                    
                # Analysis techniques
                "Use SQL aggregation functions (COUNT, SUM, AVG, MIN, MAX, STDDEV) for statistical analysis",
                "In order to identify potential outliers in numerical columns use SQL (values > 3 standard deviations from mean or outside 1.5*IQR)",
                "Create temporary tables when needed with CREATE TABLE or WITH clauses",
                "For correlations, use SQL window functions or explicit calculations",
                "Use CASE statements for conditional analysis and data transformation",
                    
                # Clarity and presentation
                "Format your responses using markdown for readability",
                "Use tables to present structured results",
                "Clearly separate your SQL queries from the execution results and explanations",
                "Present numeric results with appropriate precision (2-3 decimal places for percentages and statistics)",
                "Explain insights from the actual SQL results in clear, non-technical language",
                    
                # Error handling
                "If the requested analysis cannot be performed on the available data, explain why and suggest alternatives",
                "If column names don't match what's expected, list the actual available columns",
                "Always verify data types before performing type-specific operations (e.g., date functions on date columns)"
            ],
            tools=[duckdb_tools],
            markdown=True,
            show_tool_calls=True
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error initializing Groq agent: {str(e)}. Please check your GROQ_API_KEY."
        )
    
    return agent

@app.post("/api/analyze")
async def analyze_data(request: AnalysisRequest):
    """Run analysis on the uploaded data"""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    try:
        agent = get_agent(session.file_path)
        response = agent.run(request.question)
        
        return {
            "content": response.content,
            "tool_calls": response.tool_calls if hasattr(response, "tool_calls") else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session information including file preview"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    try:
        df = pd.read_csv(session.file_path)
        preview = df.head(5).to_dict(orient="records")
        columns = list(df.columns)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading CSV: {str(e)}")
    
    return {
        "session_id": session_id,
        "filename": session.file_name,
        "preview": preview,
        "columns": columns
    }

# Predefined analysis questions endpoint
@app.get("/api/predefined-questions")
async def get_predefined_questions():
    """Return the list of predefined analysis questions"""
    ANALYSIS_QUESTIONS = {
        "Data Profile": "Analyze the structure of the dataset: count rows, list columns with their data types, and identify primary key candidates.",
        "Numerical Summary": "For all numerical columns, calculate minimum, maximum, average, median, standard deviation, and quantiles (25%, 75%).",
        "Unique Values": "Show the count of unique values in each column.",
        "Categorical Breakdown": "For categorical columns (columns with datatypes of CHAR, VARCHAR with few unique values), show counts for each category.",
        "Basic Correlation": "Calculate pairwise correlation coefficients between numerical columns to identify potential relationships.",
        "Temporal Patterns": "If there are date columns, aggregate data by year, month, or day to show trends over time.",
        "Missing Data Analysis": "Calculate the number of missing values in each column and identify columns with the most missing data.",
        "Data Quality Check": "Check for data quality issues: duplicates, values outside expected ranges, and inconsistent formats.",
    }
    
    return {"questions": ANALYSIS_QUESTIONS}

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its associated file"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    # Delete file
    try:
        if os.path.exists(session.file_path):
            os.remove(session.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
    
    # Remove session
    del sessions[session_id]
    
    return {"message": "Session deleted successfully"}

# Session cleanup (should use a proper task scheduler in production)
@app.on_event("startup")
async def startup_event():
    # Clean old files
    try:
        if os.path.exists("temp"):
            for file in os.listdir("temp"):
                file_path = os.path.join("temp", file)
                if os.path.isfile(file_path):
                    # Remove files older than 24 hours
                    if (datetime.now().timestamp() - os.path.getmtime(file_path)) > 86400:
                        os.remove(file_path)
    except Exception as e:
        print(f"Error cleaning up old files: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    # Clean temporary files
    for session_id, session in sessions.items():
        if os.path.exists(session.file_path):
            try:
                os.remove(session.file_path)
            except Exception as e:
                print(f"Error removing file {session.file_path}: {str(e)}") 