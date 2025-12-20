import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a device for push notifications' })
  @ApiResponse({ status: 201, description: 'Device registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async register(@Request() req, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(req.user.sub, dto);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh push token when it changes' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async refreshToken(@Request() req, @Body() dto: RefreshTokenDto) {
    return this.devicesService.refreshToken(req.user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unregister a device' })
  @ApiResponse({ status: 200, description: 'Device unregistered successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async unregister(@Request() req, @Param('id') id: string) {
    return this.devicesService.unregister(req.user.sub, id);
  }

  @Delete('token/:token')
  @ApiOperation({ summary: 'Unregister a device by token' })
  @ApiResponse({ status: 200, description: 'Device unregistered successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async unregisterByToken(@Request() req, @Param('token') token: string) {
    return this.devicesService.unregisterByToken(req.user.sub, token);
  }

  @Get()
  @ApiOperation({ summary: 'List all registered devices for current user' })
  @ApiResponse({ status: 200, description: 'List of devices' })
  async findAll(@Request() req) {
    return this.devicesService.findAllByUser(req.user.sub);
  }
}
