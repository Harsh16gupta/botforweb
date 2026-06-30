import io
import time
import httpx

API_URL = "http://localhost:8000/api/v1"


def run_e2e_test():
    print("=" * 60)
    print("Documentation Chatbot SaaS E2E Smoke Test")
    print("=" * 60)

    # 1. Sign Up
    email = f"developer_{int(time.time())}@acme.com"
    password = "developerpassword123"
    org_name = "Acme Dev Tools"

    signup_payload = {
        "email": email,
        "password": password,
        "organization_name": org_name
    }
    
    print(f"\n1. Signing up user: {email} for organization: '{org_name}'...")
    try:
        response = httpx.post(f"{API_URL}/auth/signup", json=signup_payload)
        if response.status_code != 201:
            print(f"❌ Signup failed ({response.status_code}): {response.text}")
            return
        print("✅ User signed up successfully!")
    except Exception as e:
        print(f"❌ Connection error: Is the FastAPI server running on port 8000? {str(e)}")
        return

    # 2. Login
    print("\n2. Logging in to obtain JWT access token...")
    login_response = httpx.post(
        f"{API_URL}/auth/login",
        data={"username": email, "password": password}
    )
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful! Token acquired.")

    # 3. Create & Upload Sample Documentation
    sample_doc_content = """---
title: Acme CLI Quickstart
version: 1.0.0
category: Tooling
---

# Acme Command Line Interface (CLI)

The Acme CLI is a powerful tool designed to manage cloud resources directly from your terminal.

## Installation

To install the Acme CLI, run the following npm command in your terminal:
```bash
npm install -g @acme/cli
```

## Authentication

Once installed, authenticate your terminal session with the Acme cloud by running:
```bash
acme auth login --api-key <YOUR_API_KEY>
```

## Deploying Projects

To deploy your current working directory to Acme hosting, execute:
```bash
acme deploy --prod
```
"""
    
    print("\n3. Uploading sample documentation (Acme CLI guides)...")
    file_payload = {
        "file": ("acme_cli_docs.md", io.BytesIO(sample_doc_content.encode("utf-8")), "text/markdown")
    }
    
    upload_response = httpx.post(
        f"{API_URL}/docs/upload",
        files=file_payload,
        headers=headers
    )
    if upload_response.status_code != 201:
        print(f"❌ Document upload failed: {upload_response.text}")
        return
        
    doc_id = upload_response.json()["id"]
    print(f"✅ Document successfully indexed in Qdrant! Document ID: {doc_id}")

    # Wait briefly for vector db processing
    time.sleep(1)

    # 4. Query Chatbot (RAG Search)
    query = "How do I install the Acme CLI and deploy to production?"
    print(f"\n4. Querying chatbot: '{query}'...")
    
    chat_payload = {"query": query}
    chat_response = httpx.post(
        f"{API_URL}/chat/query",
        json=chat_payload,
        headers=headers
    )
    if chat_response.status_code != 200:
        print(f"❌ Chat query failed: {chat_response.text}")
        return
        
    chat_data = chat_response.json()
    print("\n--- CHATBOT ANSWER ---")
    print(chat_data["answer"])
    print("----------------------")
    print("Citations:")
    for citation in chat_data["citations"]:
        print(f"📄 Source: {citation['filename']}")
        print(f"   Context snippet: \"{citation['text'][:80]}...\"")
    print("-" * 22)

    # 5. Clean up Document
    print(f"\n5. Deleting document ID {doc_id} to clean up vector store and database...")
    delete_response = httpx.delete(
        f"{API_URL}/docs/{doc_id}",
        headers=headers
    )
    if delete_response.status_code == 244 or delete_response.status_code >= 400:
        print(f"❌ Failed to delete document: {delete_response.text}")
    else:
        print("✅ Document and vector chunks cleaned up successfully.")

    print("\n🎉 E2E Smoke Test completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    run_e2e_test()
