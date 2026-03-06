import { useState, useEffect, useCallback, useRef } from 'react';
import { postsAPI, usersAPI, notificationsAPI, chatAPI } from '../services/api';
import toast from 'react-hot-toast';

export const useFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPosts = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const { data } = await postsAPI.getFeed({ page: pageNum, limit: 10 });

      setPosts(prev => append ? [...prev, ...data.posts] : data.posts);
      setHasMore(pageNum < data.pagination.pages);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPosts(nextPage, true);
    }
  };

  const addPost = (post) => setPosts(prev => [post, ...prev]);

  const updatePost = (postId, updates) => {
    setPosts(prev => prev.map(p => p._id === postId ? { ...p, ...updates } : p));
  };

  const removePost = (postId) => setPosts(prev => prev.filter(p => p._id !== postId));

  const refresh = () => {
    setPage(1);
    loadPosts(1, false);
  };

  return { posts, loading, error, hasMore, loadingMore, loadMore, addPost, updatePost, removePost, refresh };
};

export const usePost = (postId) => {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!postId) return;
    const fetchPost = async () => {
      try {
        setLoading(true);
        const { data } = await postsAPI.getPost(postId);
        setPost(data.post);
      } catch (err) {
        setError(err.response?.data?.error || 'Post not found');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  return { post, loading, error, setPost };
};

export const useLikePost = () => {
  const [liking, setLiking] = useState({});

  const toggleLike = async (postId, currentLiked, onUpdate) => {
    if (liking[postId]) return;
    setLiking(prev => ({ ...prev, [postId]: true }));
    try {
      const { data } = await postsAPI.likePost(postId);
      onUpdate?.(postId, { likeCount: data.likeCount, liked: data.liked });
    } catch {
      toast.error('Failed to update like');
    } finally {
      setLiking(prev => ({ ...prev, [postId]: false }));
    }
  };

  return { toggleLike, liking };
};

export const useProfile = (username) => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!username) return;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const [userRes, postsRes] = await Promise.all([
          usersAPI.getProfile(username),
          usersAPI.getUserPosts(username),
        ]);
        setUser(userRes.data.user);
        setPosts(postsRes.data.posts);
      } catch (err) {
        setError(err.response?.data?.error || 'Profile not found');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  return { user, posts, loading, error };
};

export const useFollow = () => {
  const [following, setFollowing] = useState({});

  const toggleFollow = async (userId, currentFollowing, onUpdate) => {
    if (following[userId]) return;
    setFollowing(prev => ({ ...prev, [userId]: true }));
    try {
      const { data } = await usersAPI.follow(userId);
      onUpdate?.(data);
      toast.success(data.following ? 'Following!' : 'Unfollowed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to follow');
    } finally {
      setFollowing(prev => ({ ...prev, [userId]: false }));
    }
  };

  return { toggleFollow, following };
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const { data } = await notificationsAPI.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const markAllRead = async () => {
    await notificationsAPI.markRead([]);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, loading, markAllRead, refresh: fetch };
};

export const useChats = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chatAPI.getChats()
      .then(({ data }) => setChats(data.chats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateLastMessage = (chatId, message) => {
    setChats(prev => prev.map(c =>
      c._id === chatId ? { ...c, lastMessage: message, lastActivity: new Date() } : c
    ).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)));
  };

  return { chats, loading, updateLastMessage };
};

export const useInfiniteScroll = (loadMore, hasMore) => {
  const observerRef = useRef(null);

  const lastElementRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [loadMore, hasMore]);

  return lastElementRef;
};

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleSelect = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
    fileRef.current = file;
  };

  const clearPreview = () => {
    setPreview(null);
    fileRef.current = null;
  };

  return { uploading, setUploading, preview, handleSelect, clearPreview, fileRef };
};
