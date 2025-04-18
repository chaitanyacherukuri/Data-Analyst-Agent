import os
import sys
import subprocess
import uvicorn
import time
import socket

def check_port_available(port):
    """Check if a port is available"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) != 0

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

def start_server():
    """Start the uvicorn server with proper error handling"""
    # Get the PORT environment variable or use default 8000
    port_str = os.environ.get("PORT", "8000")
    try:
        port = int(port_str)
    except ValueError:
        print(f"Warning: Invalid PORT value '{port_str}', using default 8000")
        port = 8000

    # Check if port is available, otherwise find an open one
    if not check_port_available(port):
        print(f"Warning: Port {port} is already in use")
        # Try to find an available port
        for test_port in range(8001, 8020):
            if check_port_available(test_port):
                print(f"Using alternative port {test_port}")
                port = test_port
                break

    print(f"Starting uvicorn server on port: {port}")

    try:
        # Start uvicorn with proper settings for Railway
        uvicorn.run(
            "app:app",
            host="0.0.0.0",
            port=port,
            log_level="info",
            proxy_headers=True,
            forwarded_allow_ips="*",
            timeout_keep_alive=120,  # Increase keep-alive timeout to 2 minutes
            timeout_graceful_shutdown=30  # Allow 30 seconds for graceful shutdown
        )
    except Exception as e:
        print(f"Error starting server: {e}")
        print("Retrying with basic configuration...")
        try:
            # Simpler configuration as fallback
            uvicorn.run("app:app", host="0.0.0.0", port=port)
        except Exception as e2:
            print(f"Critical error starting server: {e2}")
            sys.exit(1)

if __name__ == "__main__":
    try:
        # Install packages first
        install_packages()

        # Start the server
        start_server()
    except Exception as e:
        print(f"Unhandled exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)