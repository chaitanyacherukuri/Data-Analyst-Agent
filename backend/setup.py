from setuptools import setup, find_packages

setup(
    name="data-analyst-agent",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "pydantic",
        "python-multipart",
        "pandas",
        "python-dotenv",
        "agno",
        "duckdb",
        "groq",
        "types-requests",
        "httpx",
    ],
) 