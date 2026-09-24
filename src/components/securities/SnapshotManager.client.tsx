'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Save, RotateCcw, Trash2, Plus } from 'lucide-react';

interface LabSnapshot {
  id: string;
  snapshot_name: string;
  description: string;
  disk_size_mb: number;
  created_at: string;
  restored_at: string | null;
}

interface SnapshotManagerProps {
  environmentId: string;
  environmentStatus: 'running' | 'paused' | 'provisioning' | 'terminated';
}

export function SnapshotManager({
  environmentId,
  environmentStatus,
}: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<LabSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchSnapshots();
  }, [environmentId]);

  const fetchSnapshots = async () => {
    try {
      const res = await fetch(`/api/securities/labs/advanced/${environmentId}/snapshots`);
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      const data = await res.json();
      setSnapshots(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load snapshots';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) {
      toast.error('Please enter a snapshot name');
      return;
    }

    setCreatingSnapshot(true);
    try {
      const res = await fetch(`/api/securities/labs/advanced/${environmentId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_name: snapshotName,
          description: '',
        }),
      });

      if (!res.ok) throw new Error('Failed to create snapshot');
      const newSnapshot = await res.json();
      setSnapshots((prev) => [newSnapshot, ...prev]);
      setSnapshotName('');
      setShowCreateForm(false);
      toast.success(`Snapshot "${snapshotName}" created!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Creation failed';
      toast.error(msg);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    setRestoringId(snapshotId);
    try {
      const res = await fetch(
        `/api/securities/labs/advanced/${environmentId}/snapshots/${snapshotId}/restore`,
        { method: 'POST' },
      );

      if (!res.ok) throw new Error('Failed to restore snapshot');
      await fetchSnapshots();
      toast.success('Snapshot restored!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      toast.error(msg);
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!confirm('Delete this snapshot?')) return;

    try {
      const res = await fetch(
        `/api/securities/labs/advanced/${environmentId}/snapshots/${snapshotId}`,
        { method: 'DELETE' },
      );

      if (!res.ok) throw new Error('Failed to delete snapshot');
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      toast.success('Snapshot deleted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Snapshots ({snapshots.length})</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={environmentStatus !== 'running'}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          New Snapshot
        </button>
      </div>

      {showCreateForm && (
        <Card className="p-4 bg-blue-50">
          <div className="space-y-3">
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="Snapshot name (e.g., 'Before exploit')"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateSnapshot}
                disabled={creatingSnapshot}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 rounded font-medium flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {creatingSnapshot ? 'Saving...' : 'Save Snapshot'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {snapshots.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No snapshots yet. Create one to save lab state!</p>
        ) : (
          snapshots.map((snapshot) => (
            <Card key={snapshot.id} className="p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{snapshot.snapshot_name}</p>
                <p className="text-xs text-gray-600 truncate">{snapshot.description || 'No description'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(snapshot.created_at).toLocaleString()} · {snapshot.disk_size_mb} MB
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0 ml-3">
                <button
                  onClick={() => handleRestoreSnapshot(snapshot.id)}
                  disabled={restoringId === snapshot.id || environmentStatus !== 'paused'}
                  className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  title="Restore snapshot"
                >
                  <RotateCcw className="w-4 h-4 text-blue-600" />
                </button>
                <button
                  onClick={() => handleDeleteSnapshot(snapshot.id)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Delete snapshot"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
