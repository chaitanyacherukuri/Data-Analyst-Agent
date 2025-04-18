from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import PlainTextResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
from pydantic import BaseModel
import pandas as pd
import os
import uuid
import shutil
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import csv
import importlib
import sys
import traceback
import numpy as np
from fastapi import Request

# Import with try/except to handle potential import errors
try:
    from agno.agent import Agent
    from agno.tools.duckdb import DuckDbTools
    # Don't import Groq here, we'll handle it conditionally in the get_agent function
except ImportError as e:
    print(f"Warning: Failed to import some agno modules: {e}")
    print("Some functionality may be limited")

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Check for required environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY environment variable is not set. Fallback model will be used.")

# Get PORT from environment or use default
PORT = os.getenv("PORT", "8000")
print(f"PORT environment variable is set to: {PORT}")

# Custom middleware to log all requests and responses
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Log request info
        print(f"Request: {request.method} {request.url}")
        print(f"Client IP: {request.client.host if request.client else 'unknown'}")
        print(f"Request headers: {dict(request.headers)}")

        # Process the request and get the response
        response = await call_next(request)

        # Log response info
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")

        return response

# Middleware to handle long-running requests
class TimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Set a longer timeout for file upload requests
        if request.url.path == "/api/upload":
            print("File upload request detected - using extended timeout")
            # The actual timeout is handled by the client and uvicorn settings
            # This middleware just logs the request for monitoring

        # Process the request
        response = await call_next(request)
        return response

app = FastAPI(
    title="Data Analysis API",
    description="API for analyzing CSV data with SQL queries",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Print environment information for debugging
print("Starting FastAPI application...")
print(f"GROQ_API_KEY is {'set' if GROQ_API_KEY else 'NOT SET'}")
print(f"Current working directory: {os.getcwd()}")
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")
print("Environment variables:", {k: v[:5] + '...' if k == 'GROQ_API_KEY' and v else v for k, v in os.environ.items() if not k.startswith('_')})

# Add the logging middleware first
app.add_middleware(LoggingMiddleware)

# Add the timeout middleware
app.add_middleware(TimeoutMiddleware)

# Configure CORS with more permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allowing all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Preflight requests can be cached for 10 minutes
)

# Create temp directory
os.makedirs("temp", exist_ok=True)

# Session store (in production, use Redis or a database)
sessions = {}

# Custom JSON encoder to handle NaN and Infinity values
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            # Replace NaN/Infinity with None to make it JSON serializable
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.Series):
            return self.default(obj.values)
        return super(NpEncoder, self).default(obj)

# Helper function to create proper JSON responses with our custom encoder
def create_json_response(content, status_code=200):
    """Create a JSONResponse with proper handling of numpy and pandas objects"""
    json_str = json.dumps(content, cls=NpEncoder)
    return JSONResponse(content=json.loads(json_str), status_code=status_code)

# Fallback model class for when Groq is not available
class FallbackModel:
    def __init__(self, id="fallback", temperature=0.1, max_tokens=1024, api_key=None):
        self.id = id
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.api_key = api_key

    def generate(self, prompt, **kwargs):
        return {
            "choices": [{
                "message": {
                    "content": "I'm sorry, but the Groq AI service is currently unavailable. Please try again later or contact support.",
                    "role": "assistant"
                }
            }]
        }

    # Add a synchronous run method to match API expectations
    def run(self, messages, **kwargs):
        return {
            "content": "I'm sorry, but the Groq AI service is currently unavailable. Please try again later or contact support."
        }

class AnalysisRequest(BaseModel):
    session_id: str
    question: str

class SessionData(BaseModel):
    file_path: str
    file_name: str
    created_at: datetime

# Add a root endpoint for health checks
@app.get("/", response_class=PlainTextResponse)
async def root():
    """Health check endpoint"""
    return "Data Analysis API is running. Access /docs for API documentation."

# Add a ping endpoint for simpler checks
@app.get("/ping", response_class=PlainTextResponse)
async def ping():
    return "pong"

# Add a system info endpoint for debugging
@app.get("/debug")
async def debug():
    """Return system information for debugging"""
    return {
        "python_version": sys.version,
        "current_directory": os.getcwd(),
        "files_in_directory": os.listdir(),
        "environment": {k: v[:5] + '...' if k == 'GROQ_API_KEY' and v else v for k, v in os.environ.items() if not k.startswith('_')},
        "temp_directory": os.path.exists("temp"),
        "memory_usage": sessions,
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a CSV file and create a new analysis session"""
    # Better error checking for file
    if not file or not file.filename:
        print("Error: No file uploaded or filename is empty")
        raise HTTPException(status_code=400, detail="No file uploaded")

    print(f"Received file upload: {file.filename}")
    print(f"Content type: {file.content_type}")

    if not file.filename.endswith('.csv'):
        print(f"Error: File type not supported - {file.filename}")
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    # Generate session ID and save file
    session_id = str(uuid.uuid4())
    file_path = f"temp/{session_id}_{file.filename}"

    try:
        # Ensure temp directory exists
        os.makedirs("temp", exist_ok=True)
        print(f"Temp directory exists: {os.path.exists('temp')}")

        # Save file content
        print(f"Saving file to {file_path}")
        contents = await file.read()

        # Check if file is empty
        if not contents:
            print("Error: File is empty")
            raise HTTPException(status_code=400, detail="The uploaded file is empty")

        file_size = len(contents)
        print(f"File size: {file_size} bytes")

        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        print(f"File saved successfully: {os.path.exists(file_path)}")

        # Reset file cursor for potential reuse
        await file.seek(0)
    except Exception as e:
        print(f"Error saving file: {str(e)}")
        traceback.print_exc()
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
        # Try to detect the delimiter
        with open(file_path, 'r', encoding='utf-8') as f:
            sample = f.read(4096)  # Read a sample to detect the delimiter

        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(sample)
            print(f"Detected delimiter: '{dialect.delimiter}'")
            df = pd.read_csv(file_path, sep=dialect.delimiter)
        except:
            # Fall back to standard CSV reading if delimiter detection fails
            print("Delimiter detection failed, falling back to default comma")
            df = pd.read_csv(file_path)

        # Validate that the file has at least one row and one column
        if df.empty or df.shape[1] == 0:
            print("Error: CSV file has no data or no columns")
            raise HTTPException(status_code=400, detail="The CSV file has no data or columns")

        # Convert Pandas DataFrame to a serializable format, handling NaN values
        preview = df.head(5).replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict(orient="records")
        columns = list(df.columns)
        print(f"Successfully parsed CSV with {len(df)} rows, {len(columns)} columns")
        print(f"Available columns: {columns}")
        print(f"Preview data (first few records): {preview[:2]}")
    except pd.errors.EmptyDataError:
        print("Error: Empty CSV file")
        raise HTTPException(status_code=400, detail="The CSV file is empty")
    except pd.errors.ParserError as e:
        print(f"CSV parsing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")
    except Exception as e:
        print(f"Error reading CSV: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error reading CSV: {str(e)}")

    response_data = {
        "session_id": session_id,
        "filename": file.filename,
        "preview": preview,
        "columns": columns
    }
    print(f"Upload successful. Session ID: {session_id}")
    print(f"Response data size: {len(str(response_data))} chars")

    # Return response using the custom JSON encoder
    return create_json_response(response_data)

def get_agent(file_path: str):
    """Initialize DuckDB tools and Agno agent"""
    try:
        from agno.tools.duckdb import DuckDbTools
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

        # Try to import and use Groq
        groq_available = False
        model = None

        # First try dynamic import of groq
        try:
            # Use importlib for more flexible import handling
            print("Attempting to import groq module...")
            groq_module = importlib.import_module("groq")
            print(f"Groq module imported successfully. Version: {getattr(groq_module, '__version__', 'unknown')}")

            # Then try to get the agent's Groq model
            try:
                print("Attempting to import Groq from agno.models.groq...")
                agno_groq = importlib.import_module("agno.models.groq")
                if hasattr(agno_groq, "Groq"):
                    Groq = agno_groq.Groq
                    model = Groq(
                        id="meta-llama/llama-4-scout-17b-16e-instruct",
                        temperature=0.1,
                        max_tokens=4000,
                        api_key=GROQ_API_KEY
                    )
                    groq_available = True
                    print("Successfully initialized Groq model")
                else:
                    print("The Groq class was not found in agno.models.groq")
            except ImportError as e:
                print(f"Failed to import Groq from agno.models.groq: {e}")
                # If the specific import fails, try to install
                import subprocess
                import sys
                print("Attempting to install dependencies...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "groq"])
                subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "agno"])

                # Try again
                try:
                    agno_groq = importlib.import_module("agno.models.groq")
                    if hasattr(agno_groq, "Groq"):
                        Groq = agno_groq.Groq
                        model = Groq(
                            id="meta-llama/llama-4-scout-17b-16e-instruct",
                            temperature=0.1,
                            max_tokens=4000,
                            api_key=GROQ_API_KEY
                        )
                        groq_available = True
                        print("Successfully initialized Groq model after installation")
                except Exception as e2:
                    print(f"Still failed to initialize Groq after installation: {e2}")
        except Exception as e:
            print(f"Error initializing Groq: {e}")

        # If still not available, use fallback
        if not groq_available:
            print("Using fallback model since Groq initialization failed")
            model = FallbackModel(
                id="fallback-model",
                temperature=0.1,
                max_tokens=4000,
                api_key=GROQ_API_KEY
            )

        # Create agent with appropriate model
        from agno.agent import Agent
        print("Creating Agent with model type:", type(model).__name__)
        agent = Agent(
            model=model,
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
            markdown=True
        )

        return agent
    except Exception as e:
        print(f"Error initializing agent: {str(e)}")
        # Create a fallback agent that explains the error
        try:
            # Create a minimal fallback model that doesn't depend on external services
            fallback_model = FallbackModel()

            # Create a minimal DuckDB tools instance if possible
            try:
                from agno.tools.duckdb import DuckDbTools
                duckdb_tools = DuckDbTools(
                    create_tables=True,
                    summarize_tables=True,
                    export_tables=False
                )

                # Try to load data if possible
                try:
                    duckdb_tools.load_local_csv_to_table(
                        path=file_path,
                        table="uploaded_data"
                    )
                except Exception as load_error:
                    print(f"Failed to load data in fallback mode: {str(load_error)}")
            except Exception as tools_error:
                print(f"Failed to create DuckDB tools in fallback mode: {str(tools_error)}")
                duckdb_tools = None

            # Create a minimal agent with fallback model
            from agno.agent import Agent
            fallback_agent = Agent(
                model=fallback_model,
                description="Fallback data analysis assistant",
                instructions=["Explain that there was an error with the AI service and suggest trying again later."],
                tools=[duckdb_tools] if duckdb_tools else []
            )
            return fallback_agent
        except Exception as fallback_error:
            print(f"Critical error - even fallback agent creation failed: {str(fallback_error)}")
            # Return None as a last resort - the API endpoint will need to handle this case
            return None

@app.post("/api/analyze")
async def analyze_data(request: AnalysisRequest):
    """Analyze data based on user question"""
    session_id = request.session_id

    # Check if session exists
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    session = sessions[session_id]

    try:
        # Get agent (initializes DuckDB and Groq)
        agent = get_agent(session.file_path)

        if agent is None:
            return create_json_response(
                {"error": "Failed to initialize analysis agent. Please try again later."},
                status_code=500
            )

        # Run analysis using the agent
        try:
            # Try async version first (newer versions of agno)
            response = await agent.arun(request.question)
            # Return in the format expected by frontend
            if isinstance(response, str):
                return create_json_response({"content": response})
            elif hasattr(response, 'content'):
                return create_json_response({"content": response.content})
            else:
                return create_json_response({"content": str(response)})
        except (AttributeError, TypeError) as e:
            # Fall back to sync version if async not available
            print(f"Using synchronous run as async failed: {e}")
            response = agent.run(request.question)
            # Handle different response formats
            if hasattr(response, 'content'):
                return create_json_response({"content": response.content})
            elif isinstance(response, str):
                return create_json_response({"content": response})
            else:
                return create_json_response({"content": str(response)})
    except Exception as e:
        print(f"Error in analysis: {str(e)}")
        traceback.print_exc()
        return create_json_response(
            {"error": f"Analysis failed: {str(e)}"},
            status_code=500
        )

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session information including file preview"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]

    try:
        df = pd.read_csv(session.file_path)
        # Handle NaN and Infinity values by replacing them with None
        preview = df.head(5).replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict(orient="records")
        columns = list(df.columns)
    except Exception as e:
        print(f"Error reading session CSV: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error reading CSV: {str(e)}")

    response_data = {
        "session_id": session_id,
        "filename": session.file_name,
        "preview": preview,
        "columns": columns
    }

    # Return using the custom JSON encoder to handle any remaining non-serializable values
    return create_json_response(response_data)

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
    """
    Startup event handler - runs when the application starts
    This initializes the application and cleans up old temporary files
    """
    # Clean old files
    try:
        if os.path.exists("temp"):
            for file in os.listdir("temp"):
                file_path = os.path.join("temp", file)
                if os.path.isfile(file_path):
                    # Remove files older than 24 hours
                    if (datetime.now().timestamp() - os.path.getmtime(file_path)) > 86400:
                        os.remove(file_path)
                        print(f"Cleaned up old file: {file_path}")
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

@app.options("/api/cors-check")
@app.get("/api/cors-check")
async def cors_check(request: Request):
    """CORS check endpoint to debug CORS issues"""
    headers = {k: v for k, v in request.headers.items()}
    return {
        "cors_check": "ok",
        "request_headers": headers,
        "request_method": request.method,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/system-info")
async def system_info():
    """Detailed system information for diagnosis"""
    try:
        # Get installed packages
        import pkg_resources
        installed_packages = sorted([f"{pkg.key}=={pkg.version}" for pkg in pkg_resources.working_set])

        # Check specific modules
        module_info = {}
        for module_name in ["groq", "agno", "pandas", "duckdb", "fastapi"]:
            try:
                module = importlib.import_module(module_name)
                module_info[module_name] = getattr(module, "__version__", "installed (no version)")
            except ImportError:
                module_info[module_name] = "not installed"

        # Check disk space
        import shutil
        disk_usage = shutil.disk_usage("/")
        disk_info = {
            "total_gb": round(disk_usage.total / (1024**3), 2),
            "used_gb": round(disk_usage.used / (1024**3), 2),
            "free_gb": round(disk_usage.free / (1024**3), 2),
            "percent_used": round((disk_usage.used / disk_usage.total) * 100, 2)
        }

        # Get memory info if psutil is available
        memory_info = {}
        try:
            import psutil
            mem = psutil.virtual_memory()
            memory_info = {
                "total_gb": round(mem.total / (1024**3), 2),
                "available_gb": round(mem.available / (1024**3), 2),
                "used_gb": round(mem.used / (1024**3), 2),
                "percent_used": mem.percent
            }
        except ImportError:
            memory_info = {"status": "psutil not installed"}

        return {
            "system": {
                "python_version": sys.version,
                "platform": sys.platform,
                "python_path": sys.executable,
                "environment": {k: v[:5] + '...' if k == 'GROQ_API_KEY' and v else v for k, v in os.environ.items() if k in ["PORT", "GROQ_API_KEY"]}
            },
            "disk": disk_info,
            "memory": memory_info,
            "modules": module_info,
            "sessions": {
                "count": len(sessions),
                "ids": list(sessions.keys())
            },
            "temp_directory": {
                "exists": os.path.exists("temp"),
                "file_count": len(os.listdir("temp")) if os.path.exists("temp") else 0
            },
            "packages": installed_packages[:20]  # Limit to first 20 for brevity
        }
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }