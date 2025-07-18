import { Test, TestingModule } from '@nestjs/testing';
import { HubspotService } from './hubspot.service';
import { Client } from '@hubspot/api-client'

jest.mock('@hubspot/api-client', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      crm: {
        objects: {
          searchApi: {
            doSearch: jest.fn(), // Mock do método `doSearch`
          },
        },
      },
    })),
  };
});

describe('HubspotService', () => {
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
      providers: [HubspotService
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


})