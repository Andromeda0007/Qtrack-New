import { useEffect } from 'react';
import { AppState } from 'react-native';
import { notificationsApi } from '../api/notifications';
import { useAuthStore } from '../store/authStore';
import { useNotifStore } from '../store/notifStore';

/** Polls unread notification count every 5s and syncs to the shared store. */
export function useNotifUnread(): number {
  const { isAuthenticated } = useAuthStore();
  const setCount = useNotifStore((s) => s.setCount);
  const count = useNotifStore((s) => s.count);

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
    const id = setInterval(fetchOnce, 5000);
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
