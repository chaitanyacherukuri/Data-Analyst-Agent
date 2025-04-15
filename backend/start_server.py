import os
import sys
import uvicorn

if __name__ == "__main__":
    # Get the PORT environment variable or use default 8000
    port = int(os.environ.get("PORT", "8000"))
    print(f"Starting uvicorn server on port: {port}")
    
    # Start uvicorn with the correct port
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info") 