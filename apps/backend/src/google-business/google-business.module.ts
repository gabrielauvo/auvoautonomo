import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleMetricsService } from './google-metrics.service';
import { AttributionLinksService } from './attribution-links.service';
import { AttributionLinksController, TrackingRedirectController } from './attribution-links.controller';
import { GrowthDashboardService } from './growth-dashboard.service';
import { GrowthDashboardController } from './growth-dashboard.controller';
import { GrowthInsightsService } from './growth-insights.service';

@Module({
  imports: [ConfigModule],
  controllers: [
    GoogleOAuthController,
    AttributionLinksController,
    TrackingRedirectController,
    GrowthDashboardController,
  ],
  providers: [
    GoogleOAuthService,
    GoogleMetricsService,
    AttributionLinksService,
    GrowthDashboardService,
    GrowthInsightsService,
  ],
  exports: [
    GoogleOAuthService,
    GoogleMetricsService,
    AttributionLinksService,
    GrowthDashboardService,
    GrowthInsightsService,
  ],
})
export class GoogleBusinessModule {}
