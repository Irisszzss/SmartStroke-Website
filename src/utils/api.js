import axios from 'axios';

const API_URL = 'https://smartstroke-api.onrender.com';

export const api = {
  // --- AUTHENTICATION ---
  login: (username, password) => 
    axios.post(`${API_URL}/login`, { username, password }),
    
  register: (data) => 
    axios.post(`${API_URL}/register`, data),

  // --- USER PROFILE MANAGEMENT ---
  /**
   * Updates user profile information (Name, Username, Email, etc.)
   */
  updateProfile: (userId, data) => 
    axios.put(`${API_URL}/user/${userId}`, data),

  /**
   * Specifically for uploading a custom profile picture file
   */
  uploadAvatar: (userId, file) => {
    const formData = new FormData();
    formData.append('avatar', file); // Matches upload.single('avatar') in server.js
    return axios.post(`${API_URL}/user/${userId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  /**
   * Permanently deletes the user's custom profile picture
   */
  deleteAvatar: (userId) => 
    axios.delete(`${API_URL}/user/${userId}/avatar`),
    
  // --- CLASSROOM MANAGEMENT ---
  getClasses: (userId, role) => 
    axios.get(`${API_URL}/classes/${userId}/${role}`),
    
  createClass: (name, teacherId) => 
    axios.post(`${API_URL}/create-class`, { name, teacherId }),
    
  joinClass: (studentId, classCode) => 
    axios.post(`${API_URL}/join-class`, { studentId, classCode }),

  /**
   * Permanently deletes a classroom and all its associated files
   */
  deleteClass: (classId) => 
    axios.delete(`${API_URL}/class/${classId}`),

  /**
   * Allows a student to remove themselves from a classroom
   */
  leaveClass: (classId, studentId) => 
    axios.post(`${API_URL}/class/${classId}/leave`, { studentId }),

  // --- FILE MANAGEMENT ---
  deleteFile: (classId, fileId) =>
    axios.delete(`${API_URL}/class/${classId}/file/${fileId}`),

  /**
   * Uploads the generated PDF from the Canvas to a specific class
   */
  uploadFile: (classId, file) => {
    const formData = new FormData();
    formData.append('pdf', file); // Matches upload.single('pdf') in server.js
    return axios.post(`${API_URL}/upload/${classId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // --- ROSTER MANAGEMENT ---
  /**
   * Fetches all students enrolled in a specific class
   */
  getStudents: (classId) => 
    axios.get(`${API_URL}/class/${classId}/students`),

  /**
   * Teacher tool: Removes a specific student from the class roster
   */
  removeStudent: (classId, studentId) => 
    axios.post(`${API_URL}/class/${classId}/remove-student`, { studentId })
};