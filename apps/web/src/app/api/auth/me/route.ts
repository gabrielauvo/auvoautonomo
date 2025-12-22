/**
 * API Route - Get Current User
 *
 * Proxy para /auth/me do backend, usando HttpOnly cookie para autenticação.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'auth_token';

export async function GET(request: NextRequest) {
  try {
    // Obtém token do cookie HttpOnly
    const token = request.cookies.get(AUTH_TOKEN_KEY)?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Faz requisição ao backend com o token
    const backendResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { message: errorData.message || 'Erro ao obter perfil' },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { message: 'Erro ao obter perfil. Tente novamente.' },
      { status: 500 }
    );
  }
}
