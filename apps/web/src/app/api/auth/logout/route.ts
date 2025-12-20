/**
 * API Route - Logout
 *
 * Faz logout do usuário removendo cookies HttpOnly.
 *
 * SEGURANÇA:
 * - Remove todos os tokens (auth + refresh)
 * - Invalida tokens no backend
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export async function POST(request: NextRequest) {
  try {
    // Pega token do cookie
    const token = request.cookies.get(AUTH_TOKEN_KEY)?.value;

    // Tenta invalidar token no backend (opcional)
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        // Ignora erro - logout local é suficiente
        console.warn('Backend logout failed:', error);
      }
    }

    // Remove cookies
    const response = NextResponse.json({ success: true });

    response.cookies.delete(AUTH_TOKEN_KEY);
    response.cookies.delete(REFRESH_TOKEN_KEY);

    return response;
  } catch (error) {
    console.error('Logout error:', error);

    // Mesmo com erro, remove cookies locais
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    response.cookies.delete(AUTH_TOKEN_KEY);
    response.cookies.delete(REFRESH_TOKEN_KEY);

    return response;
  }
}
