/**
 * API Route - Forgot Password
 *
 * Envia e-mail de recuperação de senha.
 *
 * SEGURANÇA:
 * - Rate limiting para prevenir abuso
 * - Não revela se o e-mail existe ou não (sempre retorna sucesso)
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, getClientIP, isValidEmail } from '@/lib/security';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ForgotPasswordRequest {
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP (mais restritivo que login)
    const clientIP = getClientIP(request.headers);
    if (!rateLimiters.login.check(clientIP)) {
      return NextResponse.json(
        { message: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429 }
      );
    }

    // Parse body
    const body: ForgotPasswordRequest = await request.json();
    const { email } = body;

    // Validação básica
    if (!email) {
      return NextResponse.json(
        { message: 'E-mail é obrigatório' },
        { status: 400 }
      );
    }

    // Valida formato de email
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: 'E-mail inválido' },
        { status: 400 }
      );
    }

    // Chama o backend para enviar e-mail de recuperação
    const backendResponse = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    // Por segurança, sempre retornamos sucesso para não revelar se o e-mail existe
    // O backend deve ter a mesma lógica
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      // Log do erro mas não expõe para o usuário
      console.error('Forgot password backend error:', errorData);
    }

    // Sempre retorna sucesso para não revelar informações
    return NextResponse.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Mesmo em caso de erro, retornamos mensagem genérica
    return NextResponse.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.',
    });
  }
}
