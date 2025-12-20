import { Body, Controller, Post, Get, UseGuards, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService, GoogleUser } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return user;
  }

  /**
   * Inicia o fluxo de login com Google
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // O guard redireciona para o Google
  }

  /**
   * Callback do Google OAuth
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = req.user as GoogleUser;
    const result = await this.authService.googleLogin(googleUser);

    // Redireciona para o frontend com o token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/google/callback?token=${result.token}`);
  }
}
