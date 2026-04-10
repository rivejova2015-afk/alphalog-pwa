import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';

export function useRealtime<T extends Record<string, unknown> & { id: string }>(
  table: string,
  userId: string,
  filter?: (item: T) => boolean
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const filterFn = useCallback(
    (item: T) => (filter ? filter(item) : true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: rows, error: err } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (err) throw new Error(err.message);

        const all = (rows ?? []) as T[];
        setData(all.filter(filterFn));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const subscription = supabase
      .channel(`${table}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as T;
            setData((prev) => (filterFn(newItem) ? [...prev, newItem] : prev));
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item) =>
                item.id === (payload.new as { id: string }).id
                  ? (payload.new as T)
                  : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData((prev) =>
              prev.filter((item) => item.id !== (payload.old as { id: string }).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      void subscription.unsubscribe();
    };
  }, [table, userId, filterFn]);

  return { data, loading, error };
}
