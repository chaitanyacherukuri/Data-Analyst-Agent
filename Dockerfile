FROM python:3.11-slim

WORKDIR /app

# Copy the current directory contents to the container
COPY . .

# Install dependencies with error handling
RUN pip install --no-cache-dir -r requirements.txt || echo "Some packages failed to install, continuing..."

# Set environment variable for port
ENV PORT=8000

# Make sure the entrypoint is executable
RUN chmod +x start_server.py

# Command to run the application
CMD ["python", "start_server.py"] 