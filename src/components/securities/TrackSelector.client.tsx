'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import type { CareerTrack } from '@/lib/securities/schemas';

interface TrackSelectorProps {
  onTrackSelect?: (trackId: string) => void;
  selectedTrackId?: string;
}

export function TrackSelector({ onTrackSelect, selectedTrackId }: TrackSelectorProps) {
  const [tracks, setTracks] = useState<CareerTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const res = await fetch('/api/securities/tracks');
        if (!res.ok) throw new Error('Failed to fetch tracks');
        const data = await res.json();
        setTracks(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load tracks';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchTracks();
  }, []);

  const handleEnroll = async (trackId: string) => {
    setEnrolling(trackId);
    try {
      const res = await fetch('/api/securities/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId }),
      });
      if (!res.ok) throw new Error('Failed to enroll');
      toast.success('Enrolled in track!');
      onTrackSelect?.(trackId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Enrollment failed';
      toast.error(msg);
    } finally {
      setEnrolling(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return <EmptyState title="No career tracks available" description="Check back soon for new tracks." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tracks.map((track) => (
        <Card key={track.id} className="p-6 hover:shadow-lg transition-shadow">
          <h3 className="font-semibold text-lg mb-2">{track.name}</h3>
          <p className="text-sm text-gray-600 mb-4">{track.description}</p>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Modules: {track.recommended_module_count || 0}</p>
            <p className="text-xs text-gray-500">Focus: {track.focus_area}</p>
          </div>
          <button
            onClick={() => handleEnroll(track.id)}
            disabled={enrolling === track.id || selectedTrackId === track.id}
            className={`w-full py-2 px-4 rounded font-medium text-sm transition-colors ${
              selectedTrackId === track.id
                ? 'bg-gray-200 text-gray-700 cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300'
            }`}
          >
            {enrolling === track.id ? 'Enrolling...' : selectedTrackId === track.id ? 'Enrolled' : 'Enroll'}
          </button>
        </Card>
      ))}
    </div>
  );
}
