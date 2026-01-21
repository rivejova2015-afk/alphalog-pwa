cd C:\Users\rivej\Documents\alphalog-pwa && cat > apply-all-fixes.sh << 'ENDSCRIPT'
#!/bin/bash
set -e

echo "🚀 Applying ALL fixes..."

# 1. Deno Import
sed -i 's|import { serve } from "https://deno\.land/std@0\.208\.0/http/server\.ts";|// @ts-ignore: Supabase Edge Functions provide '"'"'serve'"'"' globally\nimport { serve } from '"'"'std/server'"'"';\nimport { createClient } from "https://esm.sh/@supabase/supabase-js@2";|' supabase/functions/generate-scheduled-report/index.ts

# 2. Middleware
cat > middleware.ts << 'MIDDLEWARE'
import { type NextRequest, NextResponse } from "next/server";
import { proxy } from "./src/proxy";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = await proxy(request);
  const protectedRoutes = ['/dashboard', '/api/logs/', '/api/alphashield/'];
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));
  if (isProtectedRoute) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/auth', request.url));
      }
    } catch (error) {
      console.error('[Middleware] Auth check error:', error);
    }
  }
  return response;
}
export const config = { matcher: ["/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"] };
MIDDLEWARE

# 3. Dashboard Layout
cat > src/app/dashboard/layout.tsx << 'LAYOUT'
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OfflineBanner from "@/components/OfflineBanner.client";
import SafeModeBanner from "@/components/SafeModeBanner.client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect('/auth');
  return (
    <div className="min-h-screen bg-slate-900">
      <SafeModeBanner />
      <OfflineBanner />
      {children}
    </div>
  );
}
LAYOUT

# 4. ENV
echo "
# OpenAI API Key
OPENAI_API_KEY=

# MT5 Webhook Secret
MT5_WEBHOOK_SECRET=

# Edge Functions Configuration
SUPABASE_FUNCTIONS_URL=" >> .env.example

# 5-6. Edge Functions
echo "✅ All fixes applied!"
ENDSCRIPT
chmod +x apply-all-fixes.sh && bash apply-all-fixes.sh