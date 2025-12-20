# Mapa de Portas - Monorepo

## Portas Fixas (Padronizadas)

| Serviço          | Porta  | URL                       | Descrição                |
|------------------|--------|---------------------------|--------------------------|
| **Backend API**  | 3001   | http://localhost:3001     | NestJS API               |
| **Web Frontend** | 3000   | http://localhost:3000     | Next.js                  |
| **Expo/Metro**   | 8081   | http://localhost:8081     | Metro Bundler            |
| PostgreSQL       | 5432   | localhost:5432            | Database                 |
| Redis            | 6379   | localhost:6379            | Cache/Queue              |
| PDF Service      | 3002   | http://localhost:3002     | Microserviço PDF         |
| Prisma Studio    | 5555   | http://localhost:5555     | Database GUI             |

## Comandos de Desenvolvimento

```bash
# Iniciar todos (backend + web)
pnpm dev

# Iniciar todos (incluindo expo)
pnpm dev:all

# Iniciar individualmente
pnpm dev:backend   # Backend na porta 3001
pnpm dev:web       # Web na porta 3000
pnpm dev:expo      # Expo na porta 8081

# Expo com cache limpo
pnpm dev:expo:clean

# Infraestrutura (Docker)
pnpm dev:infra       # Inicia PostgreSQL + Redis
pnpm dev:infra:stop  # Para infraestrutura
```

## Configuração Mobile

### Emulador Android
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

### Simulador iOS
```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

### Dispositivo Físico
```env
EXPO_PUBLIC_API_URL=http://<SEU_IP_LOCAL>:3001
```

Para descobrir seu IP local:
- Windows: `ipconfig`
- Mac/Linux: `ifconfig` ou `ip addr`

## Verificar Portas em Uso

### Windows (PowerShell)
```powershell
# Ver todas as portas em uso
netstat -ano | findstr LISTENING

# Ver processo em porta específica
netstat -ano | findstr :3001
```

### Liberar Porta
```powershell
# Encontrar PID
netstat -ano | findstr :3001

# Matar processo
taskkill /PID <PID> /F
```
