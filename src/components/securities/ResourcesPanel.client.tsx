'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { ExternalLink, BookOpen, Video, Tool, Flag, BookMarked } from 'lucide-react';
import type { Resource } from '@/lib/securities/schemas';

interface ResourcesPanelProps {
  moduleId?: string;
  type?: 'paper' | 'video' | 'tool' | 'ctf' | 'book';
}

const resourceIcons = {
  paper: BookOpen,
  video: Video,
  tool: Tool,
  ctf: Flag,
  book: BookMarked,
};

const resourceColors = {
  paper: 'bg-blue-100 text-blue-600',
  video: 'bg-red-100 text-red-600',
  tool: 'bg-green-100 text-green-600',
  ctf: 'bg-purple-100 text-purple-600',
  book: 'bg-amber-100 text-amber-600',
};

export function ResourcesPanel({ moduleId, type }: ResourcesPanelProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const params = new URLSearchParams();
        if (moduleId) params.append('module', moduleId);
        if (type) params.append('type', type);

        const res = await fetch(`/api/securities/resources?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch resources');
        const data = await res.json();
        setResources(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load resources';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, [moduleId, type]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return <EmptyState title="No resources found" description="Check back soon for more learning materials." />;
  }

  return (
    <div className="space-y-3">
      {resources.map((resource) => {
        const Icon = resourceIcons[resource.type as keyof typeof resourceIcons];
        const color = resourceColors[resource.type as keyof typeof resourceColors];

        return (
          <a
            key={resource.id}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex gap-4">
                <div className={`inline-flex p-2 rounded-lg h-fit ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-1 line-clamp-2 hover:text-blue-600">
                    {resource.title}
                  </h4>
                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">{resource.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="inline-block px-2 py-1 bg-gray-100 rounded capitalize">
                      {resource.type}
                    </span>
                    {resource.author && <span>{resource.author}</span>}
                    {resource.rating && <span>⭐ {resource.rating.toFixed(1)}</span>}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </Card>
          </a>
        );
      })}
    </div>
  );
}
