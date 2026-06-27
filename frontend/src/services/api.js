import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:8000' });

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
