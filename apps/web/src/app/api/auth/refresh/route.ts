/**
 * API Route - Refresh Token
 *
 * Renova access token usando refresh token armazenado em HttpOnly cookie.
 *
 * SEGURANÇA:
 * - Usa refresh token HttpOnly
 * - Retorna novo access token em HttpOnly cookie
 * - Rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, getClientIP } from '@/lib/security';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

interface RefreshResponse {
  token: string;
  refreshToken?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP
    const clientIP = getClientIP(request.headers);
    if (!rateLimiters.api.check(clientIP)) {
      return NextResponse.json(
        { message: 'Muitas requisições. Aguarde um momento.' },
        { status: 429 }
      );
    }

    // Pega refresh token do cookie
    const refreshToken = request.cookies.get(REFRESH_TOKEN_KEY)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: 'Refresh token não encontrado' },
        { status: 401 }
      );
    }

    // Renova token no backend
    const backendResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!backendResponse.ok) {
      // Remove cookies inválidos
      const response = NextResponse.json(
        { message: 'Sessão expirada. Faça login novamente.' },
        { status: 401 }
      );

      response.cookies.delete(AUTH_TOKEN_KEY);
      response.cookies.delete(REFRESH_TOKEN_KEY);

      return response;
    }

    const data: RefreshResponse = await backendResponse.json();

    // Atualiza cookies
    const response = NextResponse.json({ success: true });

    // Novo access token
    response.cookies.set(AUTH_TOKEN_KEY, data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });

    // Novo refresh token (se fornecido)
    if (data.refreshToken) {
      response.cookies.set(REFRESH_TOKEN_KEY, data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { message: 'Erro ao renovar sessão' },
      { status: 500 }
    );
  }
}
