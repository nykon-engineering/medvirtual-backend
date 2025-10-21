import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { HandlerObjectCreation } from '../hubspot/handlers/objectCreation';
import { BadRequestException, NotFoundException } from '@nestjs/common';


const mockPrisma = {
  staff: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  }
}

describe('StaffService', () => {
  let service: StaffService;
  let prisma: PrismaService;


  const HandlerObjectCreationMock = {
    execute: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HandlerObjectCreation, useValue: HandlerObjectCreationMock }
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  describe('moveStaffBackToActive', () => {
    const mockStaffId = '123';
    const mockStaffData = { id: mockStaffId };
    const mockUpdatedStaff = { id: mockStaffId, status: 'active' };
    const mockFindOneResult = { id: mockStaffId, name: 'John Doe' };
  
    beforeEach(() => {
      mockPrisma.staff.findUnique.mockReset();
      mockPrisma.staff.update.mockReset();
    });
  
    it('Should throw BadRequestException if staffId is not provided', async () => {
      await expect(service.moveStaffBackToActive('')).rejects.toThrow(BadRequestException);
    });
  
    it('Should throw NotFoundException if staff is not found', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(null);
  
      await expect(service.moveStaffBackToActive(mockStaffId)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { id: mockStaffId },
        select: { id: true },
      });
    });
  
    it('Should throw BadRequestException if update fails', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(mockStaffData);
      mockPrisma.staff.update.mockResolvedValue(null);
  
      await expect(service.moveStaffBackToActive(mockStaffId)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: mockStaffId },
        data: { status: 'active' },
      });
    });
  
    it('Must update status to "active" and return updated staff', async () => {
      mockPrisma.staff.findUnique
      .mockResolvedValueOnce(mockStaffData)
      .mockResolvedValueOnce(mockFindOneResult); 
      mockPrisma.staff.update.mockResolvedValue(mockUpdatedStaff);
  
      const result = await service.moveStaffBackToActive(mockStaffId);
  
      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { id: mockStaffId },
        select: { id: true },
      });
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: mockStaffId },
        data: { status: 'active' },
      });
      expect(result).toEqual(mockFindOneResult);
    });
  });

  
});



