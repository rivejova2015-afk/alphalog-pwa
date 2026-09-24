import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';

/**
 * GET /api/securities/modules/advanced
 * Fetch advanced modules 96-100 with full content
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch modules 96-100
    const { data: modules, error: modulesError } = await supabase
      .from('securities_modules')
      .select(
        `
        id,
        module_number,
        title,
        description,
        difficulty_level,
        estimated_hours,
        industry_relevance,
        learning_outcomes,
        concepts:securities_module_concepts(count),
        lessons:securities_module_lessons(count)
      `
      )
      .gte('module_number', 96)
      .lte('module_number', 100)
      .order('module_number', { ascending: true });

    if (modulesError) throw modulesError;

    logInfo('AdvancedModulesAPI', 'Fetched advanced modules', {
      user_id: user.id,
      modules_count: modules?.length || 0,
    });

    // Transform response to include concept/lesson counts
    const transformedModules = (modules || []).map((m: any) => ({
      ...m,
      concept_count: m.concepts?.[0]?.count || 0,
      lesson_count: m.lessons?.[0]?.count || 0,
    }));

    return NextResponse.json(
      { modules: transformedModules },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
        },
      },
    );
  } catch (err) {
    logError('AdvancedModulesAPI', 'Failed to fetch modules', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }
}
