import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Backend API is running!"', () => {
      expect(appController.getHello()).toBe('Backend API is running!');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });
  });
});
