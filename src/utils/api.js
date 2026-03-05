import axios from 'axios';

const API_URL = 'https://smartstroke-api.onrender.com';

export const api = {
  // --- AUTHENTICATION ---
  login: (username, password) => 
    axios.post(`${API_URL}/login`, { username, password }),
    
  register: (data) => 
    axios.post(`${API_URL}/register`, data),

  // --- USER PROFILE MANAGEMENT ---
  updateProfile: (userId, data) => 
    axios.put(`${API_URL}/user/${userId}`, data),

  // FIXED: Field name changed from 'avatar' to 'profilePicture' to match backend
  uploadAvatar: (userId, file) => {
    const formData = new FormData();
    formData.append('profilePicture', file); 
    return axios.post(`${API_URL}/user/${userId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  deleteAvatar: (userId) => 
    axios.delete(`${API_URL}/user/${userId}/avatar`),
    
  // --- CLASSROOM MANAGEMENT ---
  getClasses: (userId, role) => 
    axios.get(`${API_URL}/classes/${userId}/${role}`),
    
  createClass: (name, teacherId) => 
    axios.post(`${API_URL}/create-class`, { name, teacherId }),
    
  joinClass: (studentId, classCode) => 
    axios.post(`${API_URL}/join-class`, { studentId, classCode }),

  // Backend should have: app.delete('/class/:classId', ...)
  deleteClass: (classId) => 
    axios.delete(`${API_URL}/class/${classId}`),

  // Match backend: app.post('/class/:classId/leave', ...)
  leaveClass: (classId, userId) => 
    axios.post(`${API_URL}/class/${classId}/leave`, { userId }),

  // --- FILE MANAGEMENT ---
  // Backend should have: app.delete('/class/:classId/file/:fileId', ...)
  deleteFile: (classId, fileId) =>
    axios.delete(`${API_URL}/class/${classId}/file/${fileId}`),

  uploadFile: (classId, file) => {
    const formData = new FormData();
    formData.append('pdf', file); 
    return axios.post(`${API_URL}/upload/${classId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // --- ROSTER MANAGEMENT ---
  getStudents: (classId) => 
    axios.get(`${API_URL}/class/${classId}/students`),

  // Recommendation: Use 'userId' here as well to match the leaveClass pattern
  removeStudent: (classId, userId) => 
    axios.post(`${API_URL}/class/${classId}/remove-student`, { userId }),

  // --- ADMIN MANAGEMENT ---
  getPendingTeachers: () => 
    axios.get(`${API_URL}/admin/pending-teachers`),

  approveTeacher: (email) => 
    axios.post(`${API_URL}/admin/approve-teacher`, { email }),

  declineTeacher: (email) => 
    axios.delete(`${API_URL}/admin/decline-teacher/${email}`)
};
