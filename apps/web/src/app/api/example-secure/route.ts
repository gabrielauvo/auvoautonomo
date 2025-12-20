/**
 * Exemplo de API Route Segura
 *
 * Este é um exemplo de como criar uma API route com todas as
 * medidas de segurança aplicadas usando os helpers.
 *
 * COPIE ESTE ARQUIVO como template para suas API routes.
 */

import { NextRequest } from 'next/server';
import { withSecurity, parseJSONBody, successResponse, errorResponse } from '@/lib/middleware-helpers';
import { isValidEmail } from '@/lib/security';

/**
 * Exemplo 1: POST com todas as validações
 */
export const POST = withSecurity(
  async (request: NextRequest) => {
    // Parse body
    const bodyResult = await parseJSONBody<{
      email: string;
      name: string;
    }>(request);

    if ('error' in bodyResult) {
      return bodyResult.error;
    }

    const { email, name } = bodyResult.data;

    // Validação de negócio
    if (!email || !name) {
      return errorResponse('Email e nome são obrigatórios', 400);
    }

    if (!isValidEmail(email)) {
      return errorResponse('Email inválido', 400);
    }

    // Sua lógica aqui
    const result = {
      id: '123',
      email,
      name,
      createdAt: new Date().toISOString(),
    };

    return successResponse(result, 201);
  },
  {
    requireCSRF: true, // Valida CSRF token
    rateLimit: 'api', // Aplica rate limiting
    allowedMethods: ['POST'], // Apenas POST permitido
    contentType: 'application/json', // Valida Content-Type
  }
);

/**
 * Exemplo 2: GET sem CSRF (idempotente)
 */
export async function GET(request: NextRequest) {
  // GET não precisa de CSRF (operação segura/idempotente)

  // Mas ainda aplica rate limiting
  const { applyRateLimit } = await import('@/lib/middleware-helpers');
  const rateLimitError = applyRateLimit(request);
  if (rateLimitError) return rateLimitError;

  // Sua lógica aqui
  const data = {
    items: [],
    total: 0,
  };

  return successResponse(data);
}

/**
 * Exemplo 3: DELETE com validações
 */
export const DELETE = withSecurity(
  async (request: NextRequest) => {
    // Pega ID da URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('ID é obrigatório', 400);
    }

    // Validação adicional
    const { isValidUUID } = await import('@/lib/security');
    if (!isValidUUID(id)) {
      return errorResponse('ID inválido', 400);
    }

    // Sua lógica de delete aqui
    // await deleteItem(id);

    return successResponse({ deleted: true });
  },
  {
    requireCSRF: true,
    rateLimit: 'api',
    allowedMethods: ['DELETE'],
  }
);

/**
 * Exemplo 4: PUT com validação manual
 */
export async function PUT(request: NextRequest) {
  // Validação manual (sem helper)
  const { validateCSRF, applyRateLimit, validateMethod } = await import('@/lib/middleware-helpers');

  // Valida método
  const methodError = validateMethod(request, ['PUT']);
  if (methodError) return methodError;

  // Valida CSRF
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  // Rate limiting
  const rateLimitError = applyRateLimit(request);
  if (rateLimitError) return rateLimitError;

  // Parse body
  const bodyResult = await parseJSONBody(request);
  if ('error' in bodyResult) {
    return bodyResult.error;
  }

  // Sua lógica aqui
  return successResponse({ updated: true });
}
