import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralController } from './referral.controller';
import { ReferralCodeService } from './services/referral-code.service';
import { ReferralClickService } from './services/referral-click.service';
import { ReferralAttributionService } from './services/referral-attribution.service';
import { ReferralRewardsService } from './services/referral-rewards.service';
import { ReferralAntifraudService } from './services/referral-antifraud.service';
import { ReferralAuditService } from './services/referral-audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReferralController],
  providers: [
    ReferralCodeService,
    ReferralClickService,
    ReferralAttributionService,
    ReferralRewardsService,
    ReferralAntifraudService,
    ReferralAuditService,
  ],
  exports: [
    ReferralCodeService,
    ReferralAttributionService,
    ReferralRewardsService,
  ],
})
export class ReferralModule {}
