import os
import sys
import subprocess
import uvicorn

def install_packages():
    """Install required packages explicitly to ensure they're available"""
    print("Installing required packages...")
    packages = [
        "groq==0.4.2",
        "agno==1.3.1",
        "httpx>=0.24.1",
        "types-requests==2.31.0.1"
    ]
    for package in packages:
        print(f"Installing {package}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to install {package}: {e}")
            print("Continuing with deployment...")
    print("Package installation completed.")

if __name__ == "__main__":
    # Install packages first
    install_packages()
    
    # Get the PORT environment variable or use default 8000
    port = int(os.environ.get("PORT", "8000"))
    print(f"Starting uvicorn server on port: {port}")
    
    # Start uvicorn with the correct port
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info") 