import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PostCard from '../components/feed/PostCard';

const mockPost = {
  _id: 'post123',
  content: 'This is a test post #testing',
  author: {
    _id: 'user123',
    username: 'testuser',
    displayName: 'Test User',
    avatar: { url: 'https://example.com/avatar.jpg' },
    isVerified: false,
  },
  likes: [],
  comments: [],
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date().toISOString(),
  visibility: 'public',
  media: [],
  hashtags: ['testing'],
};

const mockCurrentUser = { _id: 'currentuser', username: 'currentuser' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

vi.mock('../services/api', () => ({
  postsAPI: {
    likePost: vi.fn().mockResolvedValue({ data: { liked: true, likeCount: 1 } }),
    addComment: vi.fn().mockResolvedValue({ data: { comment: { content: 'Test comment', user: mockCurrentUser } } }),
    deletePost: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const renderPost = (props = {}) => render(
  <BrowserRouter>
    <PostCard post={mockPost} {...props} />
  </BrowserRouter>
);

describe('PostCard Component', () => {
  it('renders post content', () => {
    renderPost();
    expect(screen.getByText('This is a test post #testing')).toBeInTheDocument();
  });

  it('renders author name', () => {
    renderPost();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders author username', () => {
    renderPost();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('shows like count', () => {
    const postWithLikes = { ...mockPost, likeCount: 42 };
    renderPost({ post: postWithLikes });
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders hashtags as links', () => {
    renderPost();
    const hashtagLink = screen.getByText('#testing');
    expect(hashtagLink).toBeInTheDocument();
    expect(hashtagLink.closest('a')).toHaveAttribute('href', expect.stringContaining('testing'));
  });

  it('calls onLike when like button clicked', async () => {
    const onLike = vi.fn();
    renderPost({ onLike });
    fireEvent.click(screen.getByRole('button', { name: /like/i }));
    await waitFor(() => expect(onLike).toHaveBeenCalled());
  });

  it('toggles comment section on button click', () => {
    renderPost();
    const commentBtn = screen.getByRole('button', { name: /comment/i });
    fireEvent.click(commentBtn);
    expect(screen.getByPlaceholderText(/write a comment/i)).toBeInTheDocument();
  });

  it('shows delete button for own posts', () => {
    const ownPost = { ...mockPost, author: { ...mockPost.author, _id: 'currentuser' } };
    renderPost({ post: ownPost });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('hides delete button for others posts', () => {
    renderPost();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders image media', () => {
    const postWithMedia = {
      ...mockPost,
      media: [{ url: 'https://example.com/image.jpg', type: 'image', publicId: 'abc' }],
    };
    renderPost({ post: postWithMedia });
    expect(screen.getByRole('img', { name: /post media/i })).toBeInTheDocument();
  });
});
