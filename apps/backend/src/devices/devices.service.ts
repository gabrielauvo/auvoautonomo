import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto, DevicePlatformDto } from './dto/register-device.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { DevicePlatform } from '@prisma/client';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Register a new device or update existing one
   * If device with same token exists for user, update it
   * If token belongs to another user, reassign it
   */
  async register(userId: string, dto: RegisterDeviceDto) {
    const platform = dto.platform as unknown as DevicePlatform;

    // Check if token already exists
    const existingDevice = await this.prisma.device.findUnique({
      where: { expoPushToken: dto.expoPushToken },
    });

    if (existingDevice) {
      // Token exists - update it (reassign to current user if different)
      if (existingDevice.userId !== userId) {
        this.logger.log(
          `Reassigning device ${existingDevice.id} from user ${existingDevice.userId} to ${userId}`,
        );
      }

      return this.prisma.device.update({
        where: { id: existingDevice.id },
        data: {
          userId,
          platform,
          appVersion: dto.appVersion,
          deviceModel: dto.deviceModel,
          osVersion: dto.osVersion,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });
    }

    // Create new device
    return this.prisma.device.create({
      data: {
        userId,
        expoPushToken: dto.expoPushToken,
        platform,
        appVersion: dto.appVersion,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Refresh push token when it changes
   */
  async refreshToken(userId: string, dto: RefreshTokenDto) {
    // Find device with old token
    const existingDevice = await this.prisma.device.findFirst({
      where: {
        userId,
        expoPushToken: dto.oldToken,
      },
    });

    if (!existingDevice) {
      throw new NotFoundException('Device with old token not found');
    }

    // Check if new token already exists
    const conflictDevice = await this.prisma.device.findUnique({
      where: { expoPushToken: dto.newToken },
    });

    if (conflictDevice && conflictDevice.id !== existingDevice.id) {
      // New token already assigned to different device
      // Delete the old device and keep the new one
      await this.prisma.device.delete({
        where: { id: existingDevice.id },
      });

      // Update the conflicting device to belong to current user
      return this.prisma.device.update({
        where: { id: conflictDevice.id },
        data: {
          userId,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });
    }

    // Update existing device with new token
    return this.prisma.device.update({
      where: { id: existingDevice.id },
      data: {
        expoPushToken: dto.newToken,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Unregister a device by ID
   */
  async unregister(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        userId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.prisma.device.delete({
      where: { id: deviceId },
    });

    return { success: true, message: 'Device unregistered successfully' };
  }

  /**
   * Unregister device by token
   */
  async unregisterByToken(userId: string, expoPushToken: string) {
    const device = await this.prisma.device.findFirst({
      where: {
        expoPushToken,
        userId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.prisma.device.delete({
      where: { id: device.id },
    });

    return { success: true, message: 'Device unregistered successfully' };
  }

  /**
   * Get all devices for a user
   */
  async findAllByUser(userId: string) {
    return this.prisma.device.findMany({
      where: { userId, isActive: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /**
   * Get active push tokens for a user
   */
  async getActiveTokensForUser(userId: string): Promise<string[]> {
    const devices = await this.prisma.device.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        expoPushToken: true,
      },
    });

    return devices.map((d) => d.expoPushToken);
  }

  /**
   * Mark device as inactive (e.g., when push fails)
   */
  async deactivateDevice(expoPushToken: string) {
    try {
      await this.prisma.device.update({
        where: { expoPushToken },
        data: { isActive: false },
      });
      this.logger.log(`Deactivated device with token: ${expoPushToken.substring(0, 20)}...`);
    } catch (error) {
      this.logger.warn(`Failed to deactivate device: ${error.message}`);
    }
  }

  /**
   * Update last seen timestamp
   */
  async updateLastSeen(expoPushToken: string) {
    try {
      await this.prisma.device.update({
        where: { expoPushToken },
        data: { lastSeenAt: new Date() },
      });
    } catch (error) {
      // Silently fail - not critical
    }
  }

  /**
   * Clean up old inactive devices
   */
  async cleanupInactiveDevices(olderThanDays: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.device.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} inactive devices`);
    return result.count;
  }
}
