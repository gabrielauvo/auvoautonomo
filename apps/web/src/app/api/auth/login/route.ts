/**
 * API Route - Login
 *
 * Autentica usuário e armazena token em HttpOnly cookie.
 *
 * SEGURANÇA:
 * - Cookies HttpOnly (não acessíveis via JavaScript)
 * - Secure em produção (HTTPS only)
 * - SameSite=Strict (proteção CSRF)
 * - Rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, getClientIP, isValidEmail } from '@/lib/security';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    planKey?: 'FREE' | 'PRO' | 'TEAM';
    subscriptionStatus?: 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  };
  token: string;
  refreshToken?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP
    const clientIP = getClientIP(request.headers);
    if (!rateLimiters.login.check(clientIP)) {
      return NextResponse.json(
        { message: 'Muitas tentativas de login. Aguarde 1 minuto.' },
        { status: 429 }
      );
    }

    // Parse body
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validação básica
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Valida formato de email
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: 'Email inválido' },
        { status: 400 }
      );
    }

    // Faz login no backend
    const backendResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { message: errorData.message || 'Credenciais inválidas' },
        { status: backendResponse.status }
      );
    }

    const data: LoginResponse = await backendResponse.json();

    // Cria response com cookies HttpOnly
    const response = NextResponse.json({
      user: data.user,
      success: true,
    });

    // Cookie de autenticação (access token)
    response.cookies.set(AUTH_TOKEN_KEY, data.token, {
      httpOnly: true, // Não acessível via JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only em produção
      sameSite: 'strict', // Proteção CSRF
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });

    // Cookie de refresh token (se fornecido pelo backend)
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
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Erro ao processar login. Tente novamente.' },
      { status: 500 }
    );
  }
}
