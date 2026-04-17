import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { chatApi } from '../api/chat';
import { useAuthStore } from '../store/authStore';

/** Polls /chat/unread-total every 20s while the app is foregrounded. */
export function useChatUnread(): number {
  const { isAuthenticated } = useAuthStore();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setTotal(0);
      return;
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await chatApi.getUnreadTotal();
        if (!cancelled) setTotal(res.total || 0);
      } catch {
        // Silent fail; badge stays at last value
      }
    };

    fetchOnce();
    const id = setInterval(fetchOnce, 20000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchOnce();
    });

    return () => {
      cancelled = true;
      clearInterval(id);
      sub.remove();
    };
  }, [isAuthenticated]);

  return total;
}
