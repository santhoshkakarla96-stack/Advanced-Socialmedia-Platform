import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
            { refreshToken }
          );

          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          processQueue(null, data.accessToken);
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.put(`/auth/reset-password/${token}`, { password }),
};

export const postsAPI = {
  getFeed: (params) => api.get('/posts/feed', { params }),
  getPost: (id) => api.get(`/posts/${id}`),
  createPost: (formData) => api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  likePost: (id) => api.put(`/posts/${id}/like`),
  addComment: (id, content) => api.post(`/posts/${id}/comments`, { content }),
  deletePost: (id) => api.delete(`/posts/${id}`),
  searchPosts: (params) => api.get('/posts/search', { params }),
};

export const usersAPI = {
  getProfile: (username) => api.get(`/users/${username}`),
  getUserPosts: (username, params) => api.get(`/users/${username}/posts`, { params }),
  follow: (userId) => api.post(`/users/${userId}/follow`),
  updateProfile: (formData) => api.put('/users/me/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  searchUsers: (q) => api.get('/users/search/users', { params: { q } }),
};

export const chatAPI = {
  getChats: () => api.get('/chat'),
  getOrCreateDirect: (userId) => api.post('/chat/direct', { userId }),
  createGroup: (data) => api.post('/chat/group', data),
  getMessages: (chatId, params) => api.get(`/chat/${chatId}/messages`, { params }),
  sendMessage: (chatId, formData) => api.post(`/chat/${chatId}/messages`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const notificationsAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  markRead: (ids) => api.put('/notifications/read', { notificationIds: ids }),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

export const uploadAPI = {
  uploadImage: (formData) => api.post('/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadAvatar: (formData) => api.post('/upload/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadVideo: (formData) => api.post('/upload/video', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteFile: (publicId, resourceType) => api.delete(`/upload/${publicId}`, { params: { resourceType } }),
};

export default api;
