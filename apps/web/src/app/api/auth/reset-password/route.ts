/**
 * API Route - Reset Password
 *
 * Redefine a senha do usuário usando o token recebido por e-mail.
 *
 * SEGURANÇA:
 * - Valida o token antes de permitir a redefinição
 * - Rate limiting para prevenir brute force
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, getClientIP } from '@/lib/security';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ResetPasswordRequest {
  token: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP
    const clientIP = getClientIP(request.headers);
    if (!rateLimiters.login.check(clientIP)) {
      return NextResponse.json(
        { message: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429 }
      );
    }

    // Parse body
    const body: ResetPasswordRequest = await request.json();
    const { token, password } = body;

    // Validação básica
    if (!token) {
      return NextResponse.json(
        { message: 'Token é obrigatório' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { message: 'Nova senha é obrigatória' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Chama o backend para redefinir a senha
    const backendResponse = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { message: errorData.message || 'Link inválido ou expirado. Solicite um novo link.' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso!',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'Erro ao redefinir senha. Tente novamente.' },
      { status: 500 }
    );
  }
}
