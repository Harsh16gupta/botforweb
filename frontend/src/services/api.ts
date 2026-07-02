const API_BASE = 'http://localhost:8000';

export interface User {
  id: number;
  email: string;
  organization_id: number;
}

export interface Organization {
  id: number;
  name: string;
  api_key: string;
}

export interface DocumentItem {
  id: number;
  filename: string;
  file_type: string;
  status: string;
  created_at: string;
}

export interface Citation {
  document_id: number;
  filename: string;
  text: string;
}

export interface ChatQueryResponse {
  conversation_id: number;
  answer: string;
  citations: Citation[];
  confidence_score: number;
  faithfulness_score: number;
  latency_ms: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  latency_ms?: number;
  tokens_used?: number;
  created_at: string;
}

export interface ConversationResponse {
  id: number;
  title: string;
  organization_id: number;
  created_at: string;
  messages?: Message[];
}


class ApiService {
  private getHeaders(token?: string | null, apiKey?: string | null) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    return headers;
  }

  async login(email: string, password: string): Promise<string> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Login failed.');
    }
    return data.access_token;
  }

  async signup(email: string, password: string, orgName: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, organization_name: orgName }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Signup failed.');
    }
  }

  async getMe(token: string): Promise<User> {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error('Failed to retrieve user profile.');
    }
    return res.json();
  }

  async getOrganization(token: string): Promise<Organization> {
    const res = await fetch(`${API_BASE}/api/v1/auth/organization`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error('Failed to retrieve organization details.');
    }
    return res.json();
  }

  async getDocuments(token: string): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/docs`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error('Failed to retrieve documents.');
    }
    return res.json();
  }

  async uploadDocument(token: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/api/v1/docs/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Failed to upload document.');
    }
  }

  async deleteDocument(token: string, docId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/docs/${docId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error('Failed to delete document.');
    }
  }

  async queryChatbot(apiKey: string, query: string, conversationId?: number | null): Promise<ChatQueryResponse> {
    const res = await fetch(`${API_BASE}/api/v1/chat/query`, {
      method: 'POST',
      headers: this.getHeaders(null, apiKey),
      body: JSON.stringify({ query, conversation_id: conversationId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Chat query failed.');
    }
    return data;
  }

  async getConversations(token: string): Promise<ConversationResponse[]> {
    const res = await fetch(`${API_BASE}/api/v1/chat/conversations`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve conversations.');
    }
    return res.json();
  }

  async getConversation(token: string, conversationId: number): Promise<ConversationResponse> {
    const res = await fetch(`${API_BASE}/api/v1/chat/conversations/${conversationId}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve conversation details.');
    }
    return res.json();
  }
}

export const api = new ApiService();
export { API_BASE };
