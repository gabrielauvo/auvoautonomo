/**
 * Middleware Helpers
 *
 * Funções auxiliares para validação de segurança em API routes do Next.js.
 *
 * Use em suas API routes para validar CSRF, rate limiting, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFToken, rateLimiters, getClientIP } from './security';

const CSRF_TOKEN_KEY = 'csrf_token';

/**
 * Valida token CSRF em API route
 *
 * @param request - Request do Next.js
 * @returns Response de erro se inválido, null se válido
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const csrfError = validateCSRF(request);
 *   if (csrfError) return csrfError;
 *
 *   // ... resto do código
 * }
 * ```
 */
export function validateCSRF(request: NextRequest): NextResponse | null {
  // Pega token do header
  const headerToken = request.headers.get('X-CSRF-Token');

  // Pega token esperado do cookie
  const cookieToken = request.cookies.get(CSRF_TOKEN_KEY)?.value;

  // Valida
  if (!validateCSRFToken(headerToken, cookieToken)) {
    return NextResponse.json(
      { message: 'Token CSRF inválido ou ausente' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Aplica rate limiting em API route
 *
 * @param request - Request do Next.js
 * @param limiter - Limiter a usar (padrão: api)
 * @returns Response de erro se excedido, null se OK
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const rateLimitError = applyRateLimit(request, 'login');
 *   if (rateLimitError) return rateLimitError;
 *
 *   // ... resto do código
 * }
 * ```
 */
export function applyRateLimit(
  request: NextRequest,
  limiter: keyof typeof rateLimiters = 'api'
): NextResponse | null {
  const clientIP = getClientIP(request.headers);

  if (!rateLimiters[limiter].check(clientIP)) {
    return NextResponse.json(
      { message: 'Muitas requisições. Aguarde um momento.' },
      { status: 429 }
    );
  }

  return null;
}

/**
 * Valida método HTTP permitido
 *
 * @param request - Request do Next.js
 * @param allowedMethods - Métodos permitidos
 * @returns Response de erro se método não permitido, null se OK
 *
 * @example
 * ```ts
 * export async function handler(request: NextRequest) {
 *   const methodError = validateMethod(request, ['POST', 'PUT']);
 *   if (methodError) return methodError;
 *
 *   // ... resto do código
 * }
 * ```
 */
export function validateMethod(
  request: NextRequest,
  allowedMethods: string[]
): NextResponse | null {
  if (!allowedMethods.includes(request.method)) {
    return NextResponse.json(
      { message: `Método ${request.method} não permitido` },
      {
        status: 405,
        headers: {
          Allow: allowedMethods.join(', '),
        },
      }
    );
  }

  return null;
}

/**
 * Valida Content-Type
 *
 * @param request - Request do Next.js
 * @param expectedType - Content-Type esperado
 * @returns Response de erro se tipo incorreto, null se OK
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const typeError = validateContentType(request, 'application/json');
 *   if (typeError) return typeError;
 *
 *   // ... resto do código
 * }
 * ```
 */
export function validateContentType(
  request: NextRequest,
  expectedType: string
): NextResponse | null {
  const contentType = request.headers.get('Content-Type');

  if (!contentType || !contentType.includes(expectedType)) {
    return NextResponse.json(
      { message: `Content-Type deve ser ${expectedType}` },
      { status: 415 }
    );
  }

  return null;
}

/**
 * Combina múltiplas validações
 *
 * @param validations - Array de funções de validação
 * @returns Primeiro erro encontrado ou null
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const error = combineValidations([
 *     validateMethod(request, ['POST']),
 *     validateCSRF(request),
 *     applyRateLimit(request),
 *   ]);
 *
 *   if (error) return error;
 *
 *   // ... resto do código
 * }
 * ```
 */
export function combineValidations(
  validations: (NextResponse | null)[]
): NextResponse | null {
  for (const validation of validations) {
    if (validation !== null) {
      return validation;
    }
  }
  return null;
}

/**
 * Helper para criar API route segura
 *
 * Aplica validações comuns automaticamente.
 *
 * @param handler - Handler da API route
 * @param options - Opções de segurança
 * @returns Handler com validações aplicadas
 *
 * @example
 * ```ts
 * export const POST = withSecurity(
 *   async (request: NextRequest) => {
 *     // Seu código aqui
 *     return NextResponse.json({ success: true });
 *   },
 *   {
 *     requireCSRF: true,
 *     rateLimit: 'api',
 *     allowedMethods: ['POST'],
 *   }
 * );
 * ```
 */
export function withSecurity(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    requireCSRF?: boolean;
    rateLimit?: keyof typeof rateLimiters;
    allowedMethods?: string[];
    contentType?: string;
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validations: (NextResponse | null)[] = [];

    // Valida método
    if (options.allowedMethods) {
      validations.push(validateMethod(request, options.allowedMethods));
    }

    // Valida Content-Type
    if (options.contentType) {
      validations.push(validateContentType(request, options.contentType));
    }

    // Aplica rate limiting
    if (options.rateLimit) {
      validations.push(applyRateLimit(request, options.rateLimit));
    }

    // Valida CSRF
    if (options.requireCSRF) {
      validations.push(validateCSRF(request));
    }

    // Verifica se alguma validação falhou
    const error = combineValidations(validations);
    if (error) return error;

    // Executa handler
    try {
      return await handler(request);
    } catch (error) {
      console.error('API route error:', error);
      return NextResponse.json(
        { message: 'Erro interno do servidor' },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper para extrair e validar body JSON
 *
 * @param request - Request do Next.js
 * @returns Body parseado ou erro
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const body = await parseJSONBody(request);
 *
 *   if ('error' in body) {
 *     return body.error;
 *   }
 *
 *   const data = body.data;
 *   // ... usar data
 * }
 * ```
 */
export async function parseJSONBody<T = any>(
  request: NextRequest
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const data = await request.json();
    return { data };
  } catch (error) {
    return {
      error: NextResponse.json(
        { message: 'JSON inválido' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Helper para criar resposta de sucesso padronizada
 *
 * @param data - Dados de resposta
 * @param status - Status HTTP (padrão: 200)
 * @returns Response formatada
 */
export function successResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Helper para criar resposta de erro padronizada
 *
 * @param message - Mensagem de erro
 * @param status - Status HTTP (padrão: 400)
 * @returns Response formatada
 */
export function errorResponse(
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

export const middleware = {
  validateCSRF,
  applyRateLimit,
  validateMethod,
  validateContentType,
  combineValidations,
  withSecurity,
  parseJSONBody,
  successResponse,
  errorResponse,
};

export default middleware;
