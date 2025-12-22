import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Please set it in your .env file or environment variables.',
    );
  }
  return secret;
}

// Only load GoogleStrategy if credentials are configured
function getProviders(): Provider[] {
  const providers: Provider[] = [AuthService, JwtStrategy];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleStrategy);
  } else {
    console.log('Google OAuth not configured - Google login will be disabled');
  }

  return providers;
}

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: getProviders(),
  exports: [AuthService],
})
export class AuthModule {}
