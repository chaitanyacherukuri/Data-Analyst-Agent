from setuptools import setup, find_packages

setup(
    name="data-analyst-agent",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.110.0",
        "uvicorn==0.30.0",
        "pydantic==2.6.3",
        "python-multipart==0.0.9",
        "pandas==2.2.0",
        "python-dotenv==1.0.1",
        "agno==1.3.1",
        "duckdb==0.10.0",
        "groq==0.4.2",
        "types-requests==2.31.0.1",
        "httpx>=0.24.1",
    ],
) 