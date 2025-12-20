# Stack Tecnológica

## Linguagem Principal

- **TypeScript** 5.x - Todo o projeto

## Gerenciamento de Pacotes

- **pnpm** - Workspaces para monorepo
- **Node.js** 18+ (LTS)

---

## Backend (apps/backend)

### Framework e Runtime
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| NestJS | 10.x | Framework principal |
| Node.js | 18+ | Runtime |
| Express | 4.x | HTTP server (via NestJS) |

### Banco de Dados
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| PostgreSQL | 14+ | Banco principal |
| Prisma | 5.x | ORM |
| Redis | 7.x | Cache e filas |

### Autenticação e Segurança
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| @nestjs/jwt | 10.x | JWT tokens |
| @nestjs/passport | 10.x | Estratégias de auth |
| passport-jwt | 4.x | Validação JWT |
| passport-google-oauth20 | 2.x | Google OAuth |
| bcrypt | 5.x | Hash de senhas (12 rounds) |
| helmet | 7.x | Headers de segurança |
| @nestjs/throttler | 5.x | Rate limiting |

### Validação e Serialização
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| class-validator | 0.14.x | Validação de DTOs |
| class-transformer | 0.5.x | Transformação de objetos |

### Filas e Jobs
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| BullMQ | 4.x | Fila de jobs |
| @nestjs/bullmq | 10.x | Integração NestJS |

### Integrações Externas
| Tecnologia | Propósito |
|------------|-----------|
| Asaas API | Gateway de pagamento (PIX, Boleto) |
| Nodemailer | Envio de emails |
| WhatsApp API | Notificações (via templates) |

### Geração de Documentos
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| PDFKit | 0.14.x | Geração de PDFs |
| Sharp | 0.33.x | Processamento de imagens |

### Testes
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Jest | 29.x | Framework de testes |
| Supertest | 6.x | Testes de integração HTTP |

### Documentação
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| @nestjs/swagger | 7.x | OpenAPI/Swagger |

---

## Mobile (apps/mobile)

### Framework e Runtime
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Expo | 51.x | Plataforma de desenvolvimento |
| React Native | 0.74.x | Framework UI |
| Expo Router | 3.x | Navegação file-based |

### Banco de Dados Local
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| expo-sqlite | 14.x | SQLite local |

### Armazenamento Seguro
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| expo-secure-store | 13.x | Tokens (SecureStore) |

### UI e Componentes
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| NativeWind | 4.x | Tailwind para RN |
| React Native Reanimated | 3.x | Animações |
| React Native Gesture Handler | 2.x | Gestos |
| expo-image | 1.x | Imagens otimizadas |
| expo-camera | 15.x | Câmera para fotos |
| expo-image-picker | 15.x | Seleção de imagens |

### Rede e Sincronização
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| @react-native-community/netinfo | 11.x | Status de rede |
| uuid | 9.x | IDs únicos |

### Internacionalização
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| i18next | 23.x | i18n |
| react-i18next | 14.x | Integração React |

### Push Notifications
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| expo-notifications | 0.28.x | Push notifications |

### Assinatura Digital
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| react-native-signature-canvas | 4.x | Captura de assinaturas |

---

## Web (apps/web)

### Framework e Build
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Next.js | 14.x | Framework React |
| React | 18.x | UI Library |

### Estilos
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Tailwind CSS | 3.x | Utility-first CSS |
| ShadCN UI | - | Componentes base |
| Radix UI | - | Primitivos acessíveis |
| clsx | 2.x | Merge de classes |

### Estado e Cache
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| TanStack Query | 5.x | Server state |
| Zustand | 4.x | Client state |

### Formulários e Validação
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React Hook Form | 7.x | Formulários |
| Zod | 3.x | Validação de schemas |

### Gráficos e Visualização
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Recharts | 2.x | Gráficos |

### Internacionalização
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| next-intl | 3.x | i18n para Next.js |

### Testes
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Jest | 29.x | Unit tests |
| Testing Library | 14.x | DOM testing |
| Playwright | 1.x | E2E tests |

---

## DevOps e Infraestrutura

### Containerização
| Tecnologia | Propósito |
|------------|-----------|
| Docker | Containers |
| Docker Compose | Orquestração local |

### CI/CD
| Tecnologia | Propósito |
|------------|-----------|
| GitHub Actions | CI/CD pipelines |

### Serviços em Produção
| Serviço | Propósito |
|---------|-----------|
| AWS EC2 / Railway | Backend hosting |
| Vercel | Web hosting |
| AWS RDS | PostgreSQL managed |
| AWS ElastiCache | Redis managed |
| AWS S3 | Storage de arquivos |
| Expo EAS | Build e deploy mobile |

---

## Dependências Críticas

### Que NÃO devem ser atualizadas sem análise:
1. **Prisma** - Migrations podem quebrar
2. **Expo SDK** - Requer atualização coordenada
3. **NestJS** - Major versions têm breaking changes
4. **BullMQ** - Compatibilidade com Redis

### Que requerem atenção especial:
1. **bcrypt** - Nativo, pode falhar em builds
2. **Sharp** - Binários nativos
3. **expo-sqlite** - Migrations locais

---

## Variáveis de Ambiente Necessárias

### Backend
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
ASAAS_API_KEY=...
ASAAS_WEBHOOK_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
ENCRYPTION_KEY=... (32 bytes hex)
```

### Mobile
```env
EXPO_PUBLIC_API_URL=https://api.auvo.com
```

### Web
```env
NEXT_PUBLIC_API_URL=https://api.auvo.com
```
