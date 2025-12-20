import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DomainEventsService } from './domain-events.service';
import { PushService } from './push.service';
import { EventDispatcherService } from './event-dispatcher.service';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [ScheduleModule.forRoot(), DevicesModule],
  providers: [DomainEventsService, PushService, EventDispatcherService],
  exports: [DomainEventsService, PushService],
})
export class DomainEventsModule {}
