import { useState, useEffect } from 'react';

/**
 * CompletionAvatar - Profile picture with green dot completion indicator
 *
 * Displays the profile picture of the user who completed a task, with a green dot
 * indicator at the top-right corner. This replaces the standard checkbox when a
 * task is marked complete.
 *
 * Fallback hierarchy:
 * 1. Custom uploaded avatar (profiles.avatar_url)
 * 2. Initials on colored background (first letter of display name)
 */

interface CompletionAvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
  size?: number; // px, defaults to 24
}

export function CompletionAvatar({ avatarUrl, displayName, size = 24 }: CompletionAvatarProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset loading state when avatarUrl changes
  useEffect(() => {
    if (avatarUrl) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [avatarUrl]);

  // Show initials if: no URL, image is loading, or image failed to load
  const showInitials = !avatarUrl || !imageLoaded || imageError;
  const initial = displayName?.[0]?.toUpperCase() || '?';

  // Generate consistent color from display name
  const bgColor = getAvatarColor(displayName || '');

  const greenDotSize = size === 24 ? 6 : 8; // 6px for mobile (24px), 8px for tablet (32px)

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {showInitials ? (
        // Initials fallback (shown while loading or if image fails)
        <div
          className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold border-2 border-white"
          style={{
            backgroundColor: bgColor,
            fontSize: size * 0.5, // 50% of avatar size
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          {initial}
        </div>
      ) : null}

      {/* Profile picture - hidden until loaded */}
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={displayName || 'User'}
          className="w-full h-full rounded-full object-cover border-2 border-white"
          style={{
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            display: imageLoaded && !imageError ? 'block' : 'none'
          }}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}

      {/* Green completion dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: greenDotSize,
          height: greenDotSize,
          backgroundColor: '#4a9b5e', // Matches CATEGORY_COLORS.potty
          top: -1,
          right: -1,
          border: '1px solid white',
          boxShadow: '0 0 0 1px white, 0 1px 2px rgba(0, 0, 0, 0.1)',
        }}
      />
    </div>
  );
}

/**
 * Generate a consistent color for an avatar based on a string (e.g., display name)
 * Uses a simple hash to pick from a palette of pleasant colors
 */
function getAvatarColor(str: string): string {
  const colors = [
    '#E8722A', // Orange
    '#4A9B5E', // Green
    '#5B8FD4', // Blue
    '#8B6FC0', // Purple
    '#D4565B', // Red
    '#8B7355', // Brown
    '#E89B5B', // Peach
    '#6FC09B', // Teal
  ];

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
