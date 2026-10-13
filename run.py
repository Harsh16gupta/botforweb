#!/usr/bin/env python3
import os
import sys
import time
import socket
import subprocess
import threading

def check_port(host, port, timeout=1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

def wait_for_services(timeout=30):
    services = {
        "PostgreSQL": ("localhost", 5432),
        "Redis": ("localhost", 6379),
        "Qdrant": ("localhost", 6333)
    }
    print("[Docker ] Checking infrastructure services...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        all_up = True
        for name, (host, port) in services.items():
            if not check_port(host, port, timeout=0.5):
                all_up = False
                break
        if all_up:
            print("[Docker ] All infrastructure services are healthy and responding.")
            return True
        time.sleep(1)
    
    print("[Docker ] Timed out waiting for database/cache services to start.")
    for name, (host, port) in services.items():
        status = "UP" if check_port(host, port, timeout=0.5) else "DOWN"
        print(f"[Docker ] - {name} ({host}:{port}): {status}")
    return False

def log_reader(pipe, prefix, color_code):
    try:
        for line in iter(pipe.readline, b""):
            decoded = line.decode("utf-8", errors="replace").rstrip()
            print(f"\033[{color_code}m{prefix}\033[0m {decoded}")
    except Exception as e:
        print(f"\033[{color_code}m{prefix}\033[0m Error reading log stream: {e}")

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")
    
    print("[Runner ] Starting botforweb platform orchestration...")

    # Step 1: Start Docker Compose
    try:
        print("[Docker ] Starting docker compose services...")
        subprocess.run(["docker", "compose", "up", "-d"], check=True, cwd=root_dir)
    except subprocess.CalledProcessError as e:
        print(f"[Runner ] Error: Failed to start docker compose services: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("[Runner ] Error: 'docker' or 'docker compose' command not found. Please ensure Docker is installed and running.")
        sys.exit(1)

    # Step 2: Wait for services to be healthy
    if not wait_for_services():
        sys.exit(1)

    # Step 3: Verify Python virtual environment
    venv_python = os.path.join(backend_dir, "venv", "bin", "python")
    if not os.path.exists(venv_python):
        # Check for windows path just in case
        venv_python_win = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
        if os.path.exists(venv_python_win):
            venv_python = venv_python_win
        else:
            print(f"[Runner ] Error: Python virtual environment not found at '{os.path.join(backend_dir, 'venv')}'")
            print("[Runner ] Please run 'python -m venv venv' and install requirements in 'backend' directory first.")
            sys.exit(1)

    # Step 4: Verify/Install Frontend Dependencies
    node_modules_dir = os.path.join(frontend_dir, "node_modules")
    if not os.path.exists(node_modules_dir):
        print("[Vite   ] 'node_modules' not found. Installing frontend dependencies...")
        try:
            subprocess.run(["npm", "install"], check=True, cwd=frontend_dir)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"[Runner ] Error: Failed to install frontend dependencies: {e}")
            sys.exit(1)

    # Step 5: Start parallel services
    processes = []
    threads = []
    
    # Env configurations
    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    
    backend_cmd = [venv_python, "-m", "uvicorn", "app.main:app", "--port", "8000", "--reload"]
    celery_cmd = [venv_python, "-m", "celery", "-A", "app.workers.celery_app", "worker", "--loglevel=info"]
    frontend_cmd = ["npm", "run", "dev", "--", "--port", "3001"]

    services_config = [
        {"name": "[Backend ]", "cmd": backend_cmd, "cwd": backend_dir, "color": "92"}, # Green
        {"name": "[Celery  ]", "cmd": celery_cmd, "cwd": backend_dir, "color": "93"},  # Yellow
        {"name": "[Frontend]", "cmd": frontend_cmd, "cwd": frontend_dir, "color": "94"} # Blue
    ]

    try:
        for s in services_config:
            print(f"[Runner ] Starting {s['name']} service...")
            p = subprocess.Popen(
                s["cmd"],
                cwd=s["cwd"],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT
            )
            processes.append(p)
            
            # Start a logger thread for the process output
            t = threading.Thread(target=log_reader, args=(p.stdout, s["name"], s["color"]), daemon=True)
            t.start()
            threads.append(t)

        print("[Runner ] All services running. Press Ctrl+C to stop all services.")
        
        # Keep main thread alive and monitor processes
        while True:
            for p in processes:
                if p.poll() is not None:
                    # One of the processes died
                    print(f"[Runner ] Warning: Service exited with code {p.returncode}")
                    raise KeyboardInterrupt
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[Runner ] Shutting down all services...")
        
        # Terminate all processes
        for p in processes:
            if p.poll() is None:
                p.terminate()
                
        # Wait up to 3 seconds for clean exit
        start_wait = time.time()
        while time.time() - start_wait < 3:
            if all(p.poll() is not None for p in processes):
                break
            time.sleep(0.2)
            
        # Kill remaining
        for p in processes:
            if p.poll() is None:
                p.kill()
                
        print("[Runner ] All processes terminated.")
        print("[Runner ] Note: Docker services are still running in the background.")
        print("[Runner ] To stop Docker services, run: docker compose down")

if __name__ == "__main__":
    main()
