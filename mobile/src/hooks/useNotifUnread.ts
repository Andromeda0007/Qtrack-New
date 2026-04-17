import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { notificationsApi } from '../api/notifications';
import { useAuthStore } from '../store/authStore';

/** Polls notifications list every 20s and counts unread items. */
export function useNotifUnread(): number {
  const { isAuthenticated } = useAuthStore();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const list = await notificationsApi.getNotifications(true);
        if (!cancelled) setCount(Array.isArray(list) ? list.length : 0);
      } catch {}
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

  return count;
}
