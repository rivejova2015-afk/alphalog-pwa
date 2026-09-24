'use client';

import { useState, useEffect } from 'react';
import { FileText, ExternalLink, BookOpen, Tool, Award, FileCode } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Resource {
  id: string;
  title: string;
  type: 'paper' | 'tool' | 'certification' | 'tutorial' | 'course' | 'guide' | 'regulation';
  url: string;
  description: string;
  relevance: number; // 0-1 score
}

interface ModuleResourcesPanelProps {
  moduleNumber: number;
  moduleName: string;
  resources?: Resource[];
  loading?: boolean;
}

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  paper: <FileText className="w-4 h-4" />,
  tool: <Tool className="w-4 h-4" />,
  certification: <Award className="w-4 h-4" />,
  tutorial: <BookOpen className="w-4 h-4" />,
  course: <BookOpen className="w-4 h-4" />,
  guide: <BookOpen className="w-4 h-4" />,
  regulation: <FileCode className="w-4 h-4" />,
};

const RESOURCE_COLORS: Record<string, string> = {
  paper: 'bg-blue-100 text-blue-700 border-blue-200',
  tool: 'bg-green-100 text-green-700 border-green-200',
  certification: 'bg-purple-100 text-purple-700 border-purple-200',
  tutorial: 'bg-orange-100 text-orange-700 border-orange-200',
  course: 'bg-pink-100 text-pink-700 border-pink-200',
  guide: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  regulation: 'bg-red-100 text-red-700 border-red-200',
};

export function ModuleResourcesPanel({
  moduleNumber,
  moduleName,
  resources = [],
  loading = false,
}: ModuleResourcesPanelProps) {
  const [resourcesByType, setResourcesByType] = useState<Map<string, Resource[]>>(new Map());

  useEffect(() => {
    if (resources.length > 0) {
      const grouped = new Map<string, Resource[]>();
      resources.forEach((r) => {
        const type = r.type;
        if (!grouped.has(type)) {
          grouped.set(type, []);
        }
        grouped.get(type)!.push(r);
      });
      setResourcesByType(grouped);
    }
  }, [resources]);

  const handleOpenResource = (url: string, title: string) => {
    window.open(url, '_blank');
    toast.success(`Opening ${title}`);
  };

  // Default resources if none provided
  const defaultResources: Map<string, Resource[]> = new Map([
    [
      'certification',
      [
        {
          id: 'cert-1',
          title: 'Industry-Specific Certification',
          type: 'certification',
          url: '#',
          description: 'Advanced professional certification for this domain',
          relevance: 0.95,
        },
      ],
    ],
    [
      'tool',
      [
        {
          id: 'tool-1',
          title: 'Practical Security Tools',
          type: 'tool',
          url: '#',
          description: 'Open-source and commercial tools for this specialty',
          relevance: 0.90,
        },
      ],
    ],
    [
      'paper',
      [
        {
          id: 'paper-1',
          title: 'Peer-Reviewed Research',
          type: 'paper',
          url: '#',
          description: 'Latest research and findings in this field',
          relevance: 0.92,
        },
      ],
    ],
    [
      'guide',
      [
        {
          id: 'guide-1',
          title: 'Practical Implementation Guides',
          type: 'guide',
          url: '#',
          description: 'Step-by-step guides and best practices',
          relevance: 0.88,
        },
      ],
    ],
  ]);

  const displayResources = resourcesByType.size > 0 ? resourcesByType : defaultResources;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6 h-64" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Learning Resources</h3>
        <p className="text-sm text-gray-600 mt-1">
          Curated materials for {moduleName} mastery
        </p>
      </div>

      <div className="space-y-4">
        {Array.from(displayResources.entries()).map(([type, typeResources]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-gray-700">{RESOURCE_ICONS[type] || <BookOpen className="w-4 h-4" />}</div>
              <h4 className="text-sm font-semibold text-gray-900 capitalize">
                {type === 'certification' && 'Certifications'}
                {type === 'tool' && 'Tools & Frameworks'}
                {type === 'paper' && 'Research Papers'}
                {type === 'guide' && 'Guides & Best Practices'}
                {type === 'tutorial' && 'Tutorials'}
                {type === 'course' && 'Courses'}
                {type === 'regulation' && 'Regulations'}
              </h4>
              <Badge variant="secondary" className="ml-auto text-xs">
                {typeResources.length}
              </Badge>
            </div>

            <div className="space-y-2 ml-6">
              {typeResources.map((resource) => (
                <Card
                  key={resource.id}
                  className={`cursor-pointer hover:shadow-md transition-all border ${RESOURCE_COLORS[type]}`}
                  onClick={() => handleOpenResource(resource.url, resource.title)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-sm">{resource.title}</h5>
                        </div>
                        <p className="text-xs opacity-75 mb-2">{resource.description}</p>
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold opacity-75">
                            Relevance: {Math.round(resource.relevance * 100)}%
                          </div>
                          <div className="w-16 h-1.5 bg-gray-300 rounded-full">
                            <div
                              className="h-full bg-current rounded-full"
                              style={{ width: `${resource.relevance * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
        <strong>Resource Hub Tip:</strong> Start with certifications to validate expertise, then explore papers for
        deep research, and use tools for hands-on practice. Most resources are maintained by industry experts.
      </div>
    </div>
  );
}
