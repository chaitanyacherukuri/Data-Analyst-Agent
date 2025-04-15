import os
import sys
import subprocess
import uvicorn
import time

def install_packages():
    """Install required packages explicitly to ensure they're available"""
    print("Installing required packages...")
    # First install dependencies
    base_packages = [
        "httpx",
        "types-requests",
        "fastapi",
        "uvicorn",
        "pydantic",
        "python-multipart",
        "pandas",
        "python-dotenv",
        "duckdb"
    ]
    
    for package in base_packages:
        print(f"Installing base package: {package}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", package])
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to install {package}: {e}")
    
    # Then install groq and agno
    print("Installing AI packages...")
    ai_packages = ["groq", "agno"]
    for package in ai_packages:
        try:
            print(f"Installing {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", package])
            
            # Verify installation
            if package == "groq":
                try:
                    result = subprocess.run(
                        [sys.executable, "-c", f"import {package}; print(f'{package} version: ' + getattr({package}, '__version__', 'unknown'))"],
                        capture_output=True,
                        text=True
                    )
                    print(result.stdout.strip())
                except Exception:
                    print(f"Installed {package} but couldn't verify version")
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to install {package}: {e}")
            # If package installation fails, try without dependencies
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "--no-deps", package])
                print(f"Installed {package} without dependencies")
            except Exception as e2:
                print(f"Critical: Failed to install {package} even without dependencies: {e2}")
    
    print("Package installation completed.")
    # Give a moment for packages to be properly registered
    time.sleep(1)

if __name__ == "__main__":
    # Install packages first
    install_packages()
    
    # Get the PORT environment variable or use default 8000
    port = int(os.environ.get("PORT", "8000"))
    print(f"Starting uvicorn server on port: {port}")
    
    # Start uvicorn with the correct port
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info") 