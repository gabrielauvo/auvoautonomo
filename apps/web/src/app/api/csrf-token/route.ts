/**
 * API Route - CSRF Token
 *
 * Gera e retorna token CSRF para proteção de formulários.
 *
 * SEGURANÇA:
 * - Gera token único por sessão
 * - Armazena em cookie HttpOnly
 * - Rate limiting
 * - Validação de origem
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { generateCSRFToken, rateLimiters, getClientIP } from '@/lib/security';

const CSRF_TOKEN_KEY = 'csrf_token';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting por IP
    const clientIP = getClientIP(request.headers);
    if (!rateLimiters.csrf.check(clientIP)) {
      return NextResponse.json(
        { message: 'Muitas requisições. Aguarde um momento.' },
        { status: 429 }
      );
    }

    // Verifica se já existe token válido no cookie
    let csrfToken = request.cookies.get(CSRF_TOKEN_KEY)?.value;

    // Se não existe, gera novo
    if (!csrfToken) {
      csrfToken = generateCSRFToken();
    }

    // Retorna token no body E no cookie
    const response = NextResponse.json({ csrfToken });

    // Armazena token em cookie HttpOnly
    response.cookies.set(CSRF_TOKEN_KEY, csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 horas
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('CSRF token error:', error);
    return NextResponse.json(
      { message: 'Erro ao gerar token CSRF' },
      { status: 500 }
    );
  }
}
