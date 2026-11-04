import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Rota de confirmação de e-mail (PKCE/OTP) usada pelos links enviados pelo
 * Supabase Auth para: confirmação de cadastro, recuperação de senha e
 * convites. O link aponta para `${NEXT_PUBLIC_APP_URL}/auth/confirm` com
 * `token_hash` e `type` — consulte a documentação vigente do Supabase Auth
 * se o formato do link mudar.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      const redirectTo = next.startsWith("/") ? next : "/dashboard";
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", "Link inválido ou expirado. Solicite um novo.");
  return NextResponse.redirect(errorUrl);
}
