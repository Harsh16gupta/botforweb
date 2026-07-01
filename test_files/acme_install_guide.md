# Acme CLI installation and setup guide

## Installation
To install the Acme CLI utility, you must use the standard package manager. Run the following command:
```bash
npm install -g @acme/cli-tool
```

## Running the Service
To start the primary daemon, execute:
```bash
acme daemon start --port 8080
```
This launches the service in background mode listening on port 8080.
