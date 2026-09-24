'use client';

import { useState, useMemo } from 'react';
import { BookOpen, Lock, Zap, Shield, Briefcase } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Module {
  id: string;
  module_number: number;
  title: string;
  description: string;
  difficulty_level: 'advanced';
  estimated_hours: number;
  industry_relevance: string[];
  learning_outcomes: string[];
  concept_count?: number;
  lesson_count?: number;
}

interface ModulesAdvancedGridProps {
  modules?: Module[];
  loading?: boolean;
  onSelectModule?: (moduleNumber: number) => void;
}

const MODULE_ICONS: Record<number, React.ReactNode> = {
  96: <Zap className="w-5 h-5" />,
  97: <Lock className="w-5 h-5" />,
  98: <Shield className="w-5 h-5" />,
  99: <BookOpen className="w-5 h-5" />,
  100: <Briefcase className="w-5 h-5" />,
};

export function ModulesAdvancedGrid({
  modules = [],
  loading = false,
  onSelectModule,
}: ModulesAdvancedGridProps) {
  const [expandedModule, setExpandedModule] = useState<number | null>(null);

  const defaultModules: Module[] = [
    {
      id: '96',
      module_number: 96,
      title: 'Autonomous Systems Security',
      description: 'Securing autonomous vehicles, drones, robotics: firmware, communication, sensor spoofing, fail-safes',
      difficulty_level: 'advanced',
      estimated_hours: 13,
      industry_relevance: ['Automotive', 'Robotics', 'Defense', 'Aerospace'],
      learning_outcomes: [
        'Identify autonomous system vulnerabilities',
        'Defend against sensor attacks and spoofing',
        'Secure autonomous communication protocols',
      ],
      concept_count: 5,
      lesson_count: 3,
    },
    {
      id: '97',
      module_number: 97,
      title: 'Blockchain & Smart Contract Security',
      description: 'Blockchain fundamentals, smart contract vulnerabilities, DeFi security, consensus attacks, audit practices',
      difficulty_level: 'advanced',
      estimated_hours: 14,
      industry_relevance: ['FinTech', 'Crypto', 'Enterprise'],
      learning_outcomes: [
        'Understand blockchain architecture',
        'Identify smart contract vulnerabilities',
        'Prevent reentrancy and overflow attacks',
      ],
      concept_count: 5,
      lesson_count: 3,
    },
    {
      id: '98',
      module_number: 98,
      title: 'IoT & Edge Security',
      description: 'Internet of Things security: device firmware, network protocols, edge computing, constraint-based security',
      difficulty_level: 'advanced',
      estimated_hours: 12,
      industry_relevance: ['Industrial', 'Smart Home', 'Healthcare'],
      learning_outcomes: [
        'Secure IoT device lifecycles',
        'Implement edge security patterns',
        'Protect IoT communications',
      ],
      concept_count: 5,
      lesson_count: 3,
    },
    {
      id: '99',
      module_number: 99,
      title: 'Privacy Engineering',
      description: 'Building privacy by design: differential privacy, data minimization, anonymization, GDPR/CCPA implementation',
      difficulty_level: 'advanced',
      estimated_hours: 13,
      industry_relevance: ['Enterprise', 'Healthcare', 'FinTech', 'Government'],
      learning_outcomes: [
        'Design privacy-preserving systems',
        'Implement differential privacy',
        'Anonymize sensitive data',
      ],
      concept_count: 5,
      lesson_count: 3,
    },
    {
      id: '100',
      module_number: 100,
      title: 'Security Career Paths & Specializations',
      description: 'Career planning in cybersecurity: roles, certifications (OSCP, CEH, CISSP), specializations, continuous learning',
      difficulty_level: 'advanced',
      estimated_hours: 10,
      industry_relevance: ['Career Development', 'Leadership'],
      learning_outcomes: [
        'Identify security career paths',
        'Understand certification requirements',
        'Build specialized expertise',
      ],
      concept_count: 5,
      lesson_count: 3,
    },
  ];

  const displayModules = modules && modules.length > 0 ? modules : defaultModules;

  const total = useMemo(() => {
    const hours = displayModules.reduce((sum, m) => sum + m.estimated_hours, 0);
    const concepts = displayModules.reduce((sum, m) => sum + (m.concept_count || 5), 0);
    const lessons = displayModules.reduce((sum, m) => sum + (m.lesson_count || 3), 0);
    return { hours, concepts, lessons };
  }, [displayModules]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">{total.hours}</div>
              <div className="text-xs text-blue-600 mt-1">Total Hours</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700">{total.concepts}</div>
              <div className="text-xs text-purple-600 mt-1">Concepts</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-700">{total.lessons}</div>
              <div className="text-xs text-green-600 mt-1">Lessons</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Grid */}
      <div className="space-y-3">
        {displayModules.map((module) => (
          <Card
            key={module.module_number}
            className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
            onClick={() => {
              setExpandedModule(
                expandedModule === module.module_number ? null : module.module_number,
              );
              onSelectModule?.(module.module_number);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-blue-600">
                    {MODULE_ICONS[module.module_number] || <BookOpen className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-sm">
                        M{module.module_number}: {module.title}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        Advanced
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">{module.description}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm font-semibold text-blue-700">
                    {module.estimated_hours}h
                  </div>
                  <div className="text-xs text-gray-500">
                    {module.concept_count || 5} concepts
                  </div>
                </div>
              </div>
            </CardHeader>

            {expandedModule === module.module_number && (
              <CardContent className="pt-0 border-t">
                <div className="space-y-4">
                  {/* Learning Outcomes */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">
                      Key Learning Outcomes
                    </h4>
                    <ul className="space-y-1">
                      {module.learning_outcomes.slice(0, 3).map((outcome, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">→</span>
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Industry Relevance */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">
                      Industry Sectors
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {module.industry_relevance.map((sector, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {sector}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Module Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-xs font-semibold text-blue-700">
                        {module.lesson_count || 3} Lessons
                      </div>
                      <div className="text-xs text-gray-600">Comprehensive content</div>
                    </div>
                    <div className="bg-purple-50 rounded p-2">
                      <div className="text-xs font-semibold text-purple-700">
                        {module.concept_count || 5} Concepts
                      </div>
                      <div className="text-xs text-gray-600">Advanced topics</div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success(`Module M${module.module_number} selected`);
                    }}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Start Module →
                  </button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Footer Info */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-800">
          <strong>Completion Timeline:</strong> These advanced modules represent the final tier of
          CyberSec Academy. Complete all 5 modules ({total.hours} total hours) to earn your
          Advanced Security certification and unlock career specialization pathways.
        </p>
      </div>
    </div>
  );
}
