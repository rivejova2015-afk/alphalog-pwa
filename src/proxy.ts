// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresca/valida sesión (si existe) y deja cookies bien puestas.
  await supabase.auth.getUser();

  return response;
}

// Evita correr proxy en assets estáticos
export const config = {
  matcher: ["/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

