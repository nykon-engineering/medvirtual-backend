import { Test, TestingModule } from '@nestjs/testing';
import { GoogledriveService } from './googledrive.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { OAuth2Client, UserRefreshClient } from 'google-auth-library';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('axios');
jest.mock('fs');
jest.mock('path');

const prismaMock = {
  googleToken: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

describe('GoogledriveService', () => {
  let service: GoogledriveService;

  beforeEach(async () => {
    (axios.get as jest.Mock).mockReset();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (path.resolve as jest.Mock).mockImplementation((...args) => args.join('/'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogledriveService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<GoogledriveService>(GoogledriveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAuthUrl', () => {
    it('should return a valid auth url', () => {
      const url = service.generateAuthUrl();
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    });
  });

  describe('getTokens', () => {
    it('should throw if no code provided', async () => {
      await expect(service.getTokens('')).rejects.toThrow(BadRequestException);
    });

    it('should save tokens and return them', async () => {
      const fakeTokens = {
        access_token: 'access',
        refresh_token: 'refresh',
        scope: 'scope',
        token_type: 'Bearer',
        expiry_date: Date.now() + 10000,
      };

      jest
      .spyOn(OAuth2Client.prototype, 'getToken')
      .mockImplementation(async () => ({ tokens: fakeTokens } as any));


      prismaMock.googleToken.create.mockResolvedValue({ id: 1 });

      const result = await service.getTokens('valid-code');
      expect(result).toEqual(fakeTokens);
      expect(prismaMock.googleToken.create).toHaveBeenCalled();
    });
  });

  describe('getValidAccessToken', () => {
    it('should throw if no tokens found', async () => {
      prismaMock.googleToken.findFirst.mockResolvedValue(null);
      await expect(service.getValidAccessToken()).rejects.toThrow(
        BadRequestException,
      );
    });

    

    it('should refresh token if expired', async () => {
      const oldToken = {
        id: 1,
        accessToken: 'old',
        refreshToken: 'refresh',
        expiryDate: Date.now() - 1000,
      };
      prismaMock.googleToken.findFirst.mockResolvedValue(oldToken);

      jest
        .spyOn(service, 'refreshAccessToken')
        .mockResolvedValue({ access_token: 'new', expiry_date: Date.now() + 1000 });

      prismaMock.googleToken.update.mockResolvedValue({});

      const result = await service.getValidAccessToken();
      expect(result).toBe('new');
      expect(prismaMock.googleToken.update).toHaveBeenCalled();
    });
  });
});
