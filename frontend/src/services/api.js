import axios from 'axios';
import { getToken, clearAuth } from '../utils/auth';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 900000, // 15 minutes — parallel AI analysis can still take a few minutes
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// On 401, clear auth and redirect to login
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const login = (username, password) =>
  API.post('/api/auth/login', { username, password });

export const uploadDicom = (formData) =>
  API.post('/api/upload', formData);
  // Do NOT set Content-Type manually — axios auto-sets multipart/form-data with correct boundary

export const getAnalysis = (caseId) =>
  API.get(`/api/analysis/${caseId}`);

export const getCases = () =>
  API.get('/api/cases');

export const getCaseDetail = (caseId) =>
  API.get(`/api/cases/${caseId}`);

export const calculateRisk = (data) =>
  API.post('/api/risk', data);

export const submitFeedback = (data) =>
  API.post('/api/feedback', data);

export const getFeedback = (findingId) =>
  API.get(`/api/feedback/${findingId}`);

export const getAiStatus = () =>
  API.get('/api/ai/status');

export const triggerEtlImport = (sourceDir = null) =>
  API.post('/api/etl/import', { source_dir: sourceDir });

export const uploadZip = (formData) =>
  API.post('/api/upload/zip', formData);

export const getCaseSlices = (caseId) =>
  API.get(`/api/cases/${caseId}/slices`);

export const reviewFinding = (findingId, data) =>
  API.patch(`/api/findings/${findingId}/review`, data);

export const signOffCase = (caseId, signedOffBy = 'radiologist_1') =>
  API.post(`/api/cases/${caseId}/signoff`, { signed_off_by: signedOffBy });

export const updateCasePatient = (caseId, data) =>
  API.patch(`/api/cases/${caseId}`, data);

export const saveReport = (caseId, text) =>
  API.patch(`/api/cases/${caseId}/report`, { final_report_text: text });

export const updateFinding = (findingId, data) =>
  API.patch(`/api/findings/${findingId}`, data);

export const updateCaseAssessment = (caseId, data) =>
  API.patch(`/api/cases/${caseId}/assessment`, data);

export const chatWithCase = (caseId, message, history = []) =>
  API.post(`/api/cases/${caseId}/chat`, { message, history });
