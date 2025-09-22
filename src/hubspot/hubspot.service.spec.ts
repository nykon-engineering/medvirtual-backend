import { Test, TestingModule } from '@nestjs/testing';
import { HubspotService } from './hubspot.service';
import { GoogledriveService } from '../googledrive/googledrive.service';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { HandlerObjectCreation } from './handlers/objectCreation';
import { HandlerObjectPropertyChange } from './handlers/objectPropertyChange';
import { HandlerObjectDeletion } from './handlers/objectDeletion';
import { CandidatesService } from '../candidate/candidates.service';


jest.mock('axios', () => ({
  __esModule: true,
  default: {
    patch: jest.fn(),
  },
}));

const doSearchMock = jest.fn();
const clientMock = {
  crm: {
    objects: {
      searchApi: {
        doSearch: doSearchMock,
      },
    },
  },
};
jest.mock('@hubspot/api-client', () => {
  return {
    Client: jest.fn().mockImplementation(() => clientMock),
  };
});

const googleMock = {
  downloadFile: jest.fn(),
}

const prismaMock = {
  candidate: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

const candidateMock = {
  processData: jest.fn(),
}

const handlerObjectCreationMock = {
  execute: jest.fn(),
};

const handlerObjectPropertyChangeMock = {
  execute: jest.fn(),
};

const handlerObjectDeletionmock = {
  execute: jest.fn(),
}

jest.mock('../common/utils/hubspot.util', () => ({
  extractDriveFileId: jest.fn(),
}));



describe('HubspotService => GetCandidates', () => {
  let service: HubspotService;

  const dataFake = {
    virtualAssistant: '12345',
    filters: [
      { field: 'status', value: 'active' },
      { field: 'location', value: 'remote' }
    ],
    properties: ['name', 'email']
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HubspotService,
        {provide: GoogledriveService, useValue: googleMock},
        {provide: PrismaService, useValue: prismaMock},
        {provide: HandlerObjectCreation, useValue: handlerObjectCreationMock},
        {provide: HandlerObjectPropertyChange, useValue: handlerObjectPropertyChangeMock},
        {provide: HandlerObjectDeletion, useValue: handlerObjectDeletionmock},
        {provide: CandidatesService, useValue: candidateMock}
      ],
    }).compile();

    service = module.get<HubspotService>(HubspotService);

  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it ('should return 400 if the vitual Assistant is not provided', async () =>{
    const dataFakeWithoutData = {
      virtualAssistant: '',
      filters: [
        { field: 'status', value: 'active' },
        { field: 'location', value: 'remote' }
      ],
      properties: ['name', 'email']
    };

    await expect(service.getCandidates(dataFakeWithoutData)).rejects.toThrow('Virtual Assistant identifier is required');
  })

  it('should return 400 if the fetch candidates fails', async () => {
    const mockError = new Error('Hubspot API error');
    doSearchMock.mockRejectedValue(mockError);

    await expect(service.getCandidates(dataFake)).rejects.toThrow('Error fetching candidates');
  })
})

// test HubspotService => changeDataFromHubspot


describe('HubspotService => changeDataToHubspot', () => {

  let service: HubspotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HubspotService,
        {provide: GoogledriveService, useValue: googleMock},
        {provide: PrismaService, useValue: prismaMock},
        {provide: HandlerObjectCreation, useValue: handlerObjectCreationMock},
        {provide: HandlerObjectPropertyChange, useValue: handlerObjectPropertyChangeMock},
        {provide: HandlerObjectDeletion, useValue: handlerObjectDeletionmock},
        {provide: CandidatesService, useValue: candidateMock}
      ]
    }).compile();

    service = module.get<HubspotService>(HubspotService);

    jest.clearAllMocks();
  })


  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return 400 if data is not provided', async () => {
    const dataFake = {
      properties: [
        { field: 'status', value: 'active' }
      ]
    };
  await expect(service.changeDataToHubspot('', dataFake)).rejects.toThrow('Object ID is required');
  })

  it('Should return true if data is changed successfully', async () => {
    const dataFake = {
      properties: [
        { field: 'status', value: 'active' }
      ]
    };
    
    (axios.patch as jest.Mock).mockResolvedValue({ status: 200 });
    
    const result = await service.changeDataToHubspot('12345', dataFake);
    expect(result).toBe(true);
  })


})