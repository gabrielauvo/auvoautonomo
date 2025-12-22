/**
 * API Route - Generic Proxy
 *
 * Proxy todas as requisições para o backend, adicionando o token HttpOnly.
 * Isso resolve o problema de autenticação com cookies HttpOnly.
 *
 * Rotas:
 * - /api/proxy/analytics/* -> /analytics/*
 * - /api/proxy/billing/* -> /billing/*
 * - etc.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'auth_token';

async function proxyRequest(request: NextRequest, method: string) {
  try {
    // Extrai o path após /api/proxy/
    const url = new URL(request.url);
    const pathMatch = url.pathname.match(/^\/api\/proxy\/(.*)$/);
    const backendPath = pathMatch?.[1] || '';

    // Obtém token do cookie HttpOnly
    const token = request.cookies.get(AUTH_TOKEN_KEY)?.value;

    // Monta URL do backend com query params
    const backendUrl = `${API_BASE_URL}/${backendPath}${url.search}`;

    // Verifica se é upload de arquivo (multipart/form-data)
    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');

    // Monta headers - NÃO definir Content-Type para multipart (fetch define automaticamente)
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Se não for multipart, define Content-Type
    if (!isMultipart && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
    }

    // Prepara body
    let body: BodyInit | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      if (isMultipart) {
        // Para multipart, passa o FormData diretamente
        body = await request.formData();
      } else {
        try {
          body = await request.text();
        } catch {
          // Sem body
        }
      }
    }

    // Faz requisição ao backend
    const backendResponse = await fetch(backendUrl, {
      method,
      headers,
      body: body || undefined,
    });

    // Verifica se é resposta binária (PDF, imagens, etc.)
    const responseContentType = backendResponse.headers.get('Content-Type') || 'application/json';
    const isBinaryResponse =
      responseContentType.includes('application/pdf') ||
      responseContentType.includes('application/octet-stream') ||
      responseContentType.includes('image/') ||
      responseContentType.includes('audio/') ||
      responseContentType.includes('video/');

    // Retorna resposta do backend
    if (isBinaryResponse) {
      // Para respostas binárias, usar arrayBuffer para preservar os dados
      const buffer = await backendResponse.arrayBuffer();
      return new NextResponse(buffer, {
        status: backendResponse.status,
        headers: {
          'Content-Type': responseContentType,
          'Content-Disposition': backendResponse.headers.get('Content-Disposition') || '',
          'Content-Length': backendResponse.headers.get('Content-Length') || '',
        },
      });
    }

    // Para respostas de texto/JSON
    const data = await backendResponse.text();

    return new NextResponse(data, {
      status: backendResponse.status,
      headers: {
        'Content-Type': responseContentType,
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { message: 'Erro ao conectar com o servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}
