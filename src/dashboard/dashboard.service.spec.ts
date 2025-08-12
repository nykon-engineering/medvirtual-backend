import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { HandlerOrganization } from './handlers/organization';
import { HandlerClient } from './handlers/client';
import { BadRequestException } from '@nestjs/common';

describe('DashboardService', () => {
  let service: DashboardService;
  let handlerOrganization: HandlerOrganization;
  let handlerClient: HandlerClient;

  const mockHandlerOrganization = {
    execute: jest.fn(),
  };

  const mockHandlerClient = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: HandlerOrganization, useValue: mockHandlerOrganization },
        { provide: HandlerClient, useValue: mockHandlerClient },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    handlerOrganization = module.get<HandlerOrganization>(HandlerOrganization);
    handlerClient = module.get<HandlerClient>(HandlerClient);

    jest.clearAllMocks();
  });

  it('deve chamar organization.execute para organization_super_admin', async () => {
    const user = { role: 'organization_super_admin' } as any;
    mockHandlerOrganization.execute.mockResolvedValue('org data');

    const result = await service.getDashboardData(user);

    expect(handlerOrganization.execute).toHaveBeenCalledWith(user);
    expect(handlerOrganization.execute).toHaveBeenCalledTimes(1);
    expect(result).toBe('org data');
  });

  it('deve chamar organization.execute para organization_admin', async () => {
    const user = { role: 'organization_admin' } as any;
    mockHandlerOrganization.execute.mockResolvedValue('org admin data');

    const result = await service.getDashboardData(user);

    expect(handlerOrganization.execute).toHaveBeenCalledWith(user);
    expect(result).toBe('org admin data');
  });

  it('deve chamar client.execute para system_super_admin', async () => {
    const user = { role: 'system_super_admin' } as any;
    mockHandlerClient.execute.mockResolvedValue('client data');

    const result = await service.getDashboardData(user);

    expect(handlerClient.execute).toHaveBeenCalledWith(user);
    expect(result).toBe('client data');
  });

  it('deve chamar client.execute para system_admin', async () => {
    const user = { role: 'system_admin' } as any;
    mockHandlerClient.execute.mockResolvedValue('client admin data');

    const result = await service.getDashboardData(user);

    expect(handlerClient.execute).toHaveBeenCalledWith(user);
    expect(result).toBe('client admin data');
  });

  it('deve lançar exceção para role inválido', async () => {
    const user = { role: 'invalid_role' } as any;

    await expect(service.getDashboardData(user)).rejects.toThrow(BadRequestException);
  });
});
