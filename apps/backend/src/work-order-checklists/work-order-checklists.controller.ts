import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { WorkOrderChecklistsService } from './work-order-checklists.service';
import { CreateWorkOrderChecklistDto } from './dto/create-checklist.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Work Order Checklists')
@ApiBearerAuth('JWT-auth')
@Controller('work-orders/:workOrderId/checklists')
@UseGuards(JwtAuthGuard)
export class WorkOrderChecklistsController {
  constructor(private readonly service: WorkOrderChecklistsService) {}

  @Post()
  @ApiOperation({ summary: 'Create checklist from template for work order' })
  @ApiParam({ name: 'workOrderId', description: 'Work order UUID' })
  @ApiBody({ type: CreateWorkOrderChecklistDto })
  @ApiResponse({
    status: 201,
    description: 'Checklist created successfully with title snapshot',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Work order or template not found or does not belong to you',
  })
  create(
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: CreateWorkOrderChecklistDto,
  ) {
    return this.service.create(user.id, workOrderId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all checklists for a work order' })
  @ApiParam({ name: 'workOrderId', description: 'Work order UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns all checklists with answer count',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Work order not found or access denied' })
  findAll(@CurrentUser() user: any, @Param('workOrderId') workOrderId: string) {
    return this.service.findAll(user.id, workOrderId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single checklist with template items, conditions, and answers',
  })
  @ApiParam({ name: 'workOrderId', description: 'Work order UUID' })
  @ApiParam({ name: 'id', description: 'Checklist UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Returns checklist with template items (including conditions) and existing answers',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  findOne(
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(user.id, workOrderId, id);
  }

  @Post(':id/answers')
  @ApiOperation({
    summary: 'Submit answers to checklist (validates conditions and requirements)',
  })
  @ApiParam({ name: 'workOrderId', description: 'Work order UUID' })
  @ApiParam({ name: 'id', description: 'Checklist UUID' })
  @ApiBody({ type: SubmitAnswersDto })
  @ApiResponse({
    status: 201,
    description:
      'Answers validated and saved (conditions checked, required items validated)',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error (type mismatch, condition not met, required item missing, invalid SELECT option)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  submitAnswers(
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
    @Param('id') id: string,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.service.submitAnswers(user.id, workOrderId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete checklist' })
  @ApiParam({ name: 'workOrderId', description: 'Work order UUID' })
  @ApiParam({ name: 'id', description: 'Checklist UUID' })
  @ApiResponse({ status: 200, description: 'Checklist deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  remove(
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(user.id, workOrderId, id);
  }
}
