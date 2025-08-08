#!/usr/bin/env python3
import argparse
import os
import sys
import time
import traceback
from typing import Optional

try:
    import requests
except Exception:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--quiet', 'requests'])
    import requests


def ping(base_url: str, timeout: float = 10.0) -> tuple[int, Optional[str]]:
    url = base_url.rstrip('/') + '/ping'
    resp = requests.get(url, timeout=timeout)
    try:
        text = resp.text
    except Exception:
        text = None
    return resp.status_code, text


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test for backend /ping endpoint")
    parser.add_argument('--base-url', default=os.getenv('BACKEND_BASE_URL'), help='Base URL of the deployed backend (e.g. https://service.onrender.com)')
    parser.add_argument('--timeout', type=float, default=float(os.getenv('SMOKE_TIMEOUT', '10')), help='Request timeout in seconds (default: 10)')
    parser.add_argument('--retries', type=int, default=int(os.getenv('SMOKE_RETRIES', '30')), help='Number of retries (default: 30)')
    parser.add_argument('--delay', type=float, default=float(os.getenv('SMOKE_DELAY', '10')), help='Delay between retries in seconds (default: 10)')
    args = parser.parse_args()

    if not args.base_url:
        print('ERROR: --base-url not provided and BACKEND_BASE_URL not set')
        return 2

    print(f"Smoke test target: {args.base_url}")
    print(f"Retries: {args.retries}, Delay: {args.delay}s, Timeout: {args.timeout}s")

    last_error = None
    for attempt in range(1, args.retries + 1):
        try:
            status, body = ping(args.base_url, timeout=args.timeout)
            print(f"Attempt {attempt}/{args.retries}: status={status}, body={repr(body)}")
            if status == 200:
                print("SUCCESS: Backend responded to /ping")
                return 0
            else:
                last_error = f"Non-200 status: {status}"
        except Exception as e:
            last_error = f"Exception: {e}"
            traceback.print_exc(limit=1)
        time.sleep(args.delay)

    print(f"FAILURE: Backend did not become healthy. Last error: {last_error}")
    return 1


if __name__ == '__main__':
    sys.exit(main())

