import { Test, TestingModule } from '@nestjs/testing';
import { HubspotService } from './hubspot.service';
import { GoogledriveService } from '../googledrive/googledrive.service';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { HandlerObjectCreation } from './handlers/objectCreation';
import { HandlerObjectPropertyChange } from './handlers/objectPropertyChange';
import { HandlerObjectDeletion } from './handlers/objectDeletion';
import { CandidatesService } from '../candidate/candidates.service';
import { HandlerOrganizationCreation } from './handlers/organizationCreation';
import { HandlerOrganizationPropertyChange } from './handlers/organizationPropertyChange';
import { HandlerOrganizationDeletion } from './handlers/organizationDeletion';
import { HandlerOrganizationAssociationChange } from './handlers/organizationAssociationChange';
import { HandlerOrganizationMerge } from './handlers/organizationMerge';
import { HandlerOwnerCreation } from './handlers/ownerCreation';
import { HandlerOwnerDeletion } from './handlers/ownerDeletion';
import { HandlerOwnerPropertyChange } from './handlers/ownerPropertyChange';
import { HandlerDealCreation } from './handlers/dealCreation';
import { HandlerDealPropertyChange } from './handlers/dealPropertyChange';
import { HandlerDealDeletion } from './handlers/dealDeletion';
import { HandlerDealAssociationChange } from './handlers/dealAssociationChange';
import { HireRequestCreationService } from './create/hireRequest';
import { HireRequestUpdateService } from './update/hireRequest';
import { HandlerTicketCreation } from './handlers/ticketCreation';
import { HandlerTicketDeletion } from './handlers/ticketDeletion';
import { HandlerTicketRestore } from './handlers/ticketRestore';
import { HandlerTicketPropertyChange } from './handlers/ticketPropertyChange';

import { HandlerAffiliateCreation } from './handlers/affiliateCreation';
import { HandlerAffiliatePropertyChange } from './handlers/affiliatePropertyChange';

import { HandlerInvoiceCreation } from './handlers/invoiceCreation';
import { HandlerInvoicePropertyChange } from './handlers/invoicePropertyChange';
import { HandlerInvoiceAssociationChange } from './handlers/invoiceAssociationChange';

import { HandlerComissionCreation } from './handlers/comissionCreation';

import { OrganizationCreationService } from './create/Organization';
import { HandlerObjectMerge } from './handlers/objectMerge';
import { OwnerCreationService } from './create/Owner';
import { AffiliateCreationService } from './create/affiliate';

import { OrganizationUpdateService } from './update/organization';
import { ContactCreationService } from './create/contact';
import { ContactFromCompanyCreationService } from './create/contactFromCompany';
import { ContactUpdateService } from './update/contact';
import { ContactDeleteService } from './delete/contact';
import { CompanyDeleteService } from './delete/company';



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

const HandlerObjectMergeMock = {
  execute: jest.fn(),
}

const HandlerOrganizationCreationMock = {
  execute: jest.fn(),
}

const HandlerOrganizationPropertyChangeMock = {
  execute: jest.fn(),
}

const HandlerOrganizationAssociationChangeMock = {
  execute: jest.fn(),
}

const HandlerOrganizationDeletionMock = {
  execute: jest.fn(),
}

const HandlerOrganizationMergeMock = {
  execute: jest.fn(),
}

const HandlerObjectDeletionMock = {
  execute: jest.fn(),
}

const HandlerOwnerCreationMock = {
  execute: jest.fn(),
}

const HandlerOwnerPropertyChangeMock = {
  execute: jest.fn(),
}

const HandlerOwnerDeletionMock = {
  execute: jest.fn(),
}

const HandlerDealCreationMock = {
  execute: jest.fn(),
}

const HandlerDealPropertyChangeMock = {
  execute: jest.fn(),
}

const HandlerDealDeletionMock = {
  execute: jest.fn(),
}

const HandlerDealAssociationChangeMock = {
  execute: jest.fn(),
}

const HandlerTicketCreationMock = {
  execute: jest.fn(),
};

const HandlerTicketRestoreMock = {
  execute: jest.fn(),
};

const HandlerTicketDeletionMock = {
  execute: jest.fn(),
};

const HandlerTicketPropertyChangeMock = {
  execute: jest.fn(),
};

const HandlerAffiliateCreationMock = {
  execute: jest.fn(),
};

const HandlerAffiliatePropertyChangeMock = {
  execute: jest.fn(),
};

const hireRequestCreationServiceMock = {
  execute: jest.fn(),
};

const hireRequestUpdateServiceMock = {
  execute: jest.fn(),
};

const organizationCreationServiceMock = {
  execute: jest.fn(),
};

const organizationUpdateServiceMock = {
  execute: jest.fn(),
};

const ownerCreationServiceMock = {
  execute: jest.fn(),
};

const contactCreationServiceMock = {
  execute: jest.fn(),
};

const contactCreationFromCompanyServiceMock = {
  execute: jest.fn(),
};

const affiliateCreationServiceMock = {
  execute: jest.fn(),
};

const updateContactServiceMock = {
  execute: jest.fn(),
};

const deleteContactServiceMock = {
  execute: jest.fn(),
};

const companyDeleteServiceMock = {
  execute: jest.fn(),
};

const HandlerInvoiceCreationMock = {
  execute: jest.fn(),
};

const HandlerInvoicePropertyChangeMock = {
  execute: jest.fn(),
};

const HandlerInvoiceAssociationChangeMock = {
  execute: jest.fn(),
};

const HandlerComissionCreationMock = {
  execute: jest.fn(),
};  

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
        {provide: HandlerObjectMerge, useValue: HandlerObjectMergeMock},
        {provide: HandlerOrganizationCreation, useValue: HandlerOrganizationCreationMock},
        {provide: HandlerOrganizationPropertyChange, useValue: HandlerOrganizationPropertyChangeMock},
        {provide: HandlerOrganizationAssociationChange, useValue: HandlerOrganizationAssociationChangeMock},
        {provide: HandlerOrganizationDeletion, useValue: HandlerOrganizationDeletionMock},
        {provide: HandlerOrganizationMerge, useValue: HandlerOrganizationMergeMock},
        {provide: HandlerOwnerCreation, useValue: HandlerOwnerCreationMock},
        {provide: HandlerOwnerDeletion, useValue: HandlerOwnerDeletionMock},
        {provide: HandlerOwnerPropertyChange , useValue: HandlerOwnerPropertyChangeMock},
        {provide: CandidatesService, useValue: candidateMock},
        {provide: HandlerDealCreation, useValue: HandlerDealCreationMock},
        {provide: HandlerDealPropertyChange, useValue: HandlerDealPropertyChangeMock},
        {provide: HandlerDealDeletion, useValue: HandlerDealDeletionMock},
        {provide: HandlerDealAssociationChange, useValue: HandlerDealAssociationChangeMock},
        {provide: HireRequestCreationService, useValue: hireRequestCreationServiceMock},
        {provide: HireRequestUpdateService, useValue: hireRequestUpdateServiceMock},
        {provide: HandlerTicketCreation, useValue: HandlerTicketCreationMock},
        {provide: HandlerTicketDeletion, useValue: HandlerTicketDeletionMock},
        {provide: HandlerTicketRestore, useValue: HandlerTicketRestoreMock},
        {provide: HandlerTicketPropertyChange, useValue: HandlerTicketPropertyChangeMock},
        {provide: OrganizationCreationService, useValue: organizationCreationServiceMock},
        {provide: OrganizationUpdateService, useValue: organizationUpdateServiceMock},
        {provide: OwnerCreationService, useValue: ownerCreationServiceMock},
        {provide: ContactCreationService, useValue: contactCreationServiceMock},
        {provide: ContactFromCompanyCreationService, useValue: contactCreationFromCompanyServiceMock},
        {provide: ContactUpdateService, useValue: updateContactServiceMock},
        {provide: ContactDeleteService, useValue: deleteContactServiceMock},
        {provide: CompanyDeleteService, useValue: companyDeleteServiceMock},
        {provide: HandlerAffiliateCreation, useValue: HandlerAffiliateCreationMock},
        {provide: HandlerAffiliatePropertyChange, useValue: HandlerAffiliatePropertyChangeMock},
        {provide: HandlerInvoiceCreation, useValue: HandlerInvoiceCreationMock},
        {provide: HandlerInvoicePropertyChange, useValue: HandlerInvoicePropertyChangeMock},
        {provide: HandlerInvoiceAssociationChange, useValue: HandlerInvoiceAssociationChangeMock},
        {provide: HandlerComissionCreation, useValue: HandlerComissionCreationMock},
        {provide: AffiliateCreationService, useValue: affiliateCreationServiceMock},
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
        {provide: HandlerObjectMerge, useValue: HandlerObjectMergeMock},
        {provide: HandlerOrganizationCreation, useValue: HandlerOrganizationCreationMock},
        {provide: HandlerOrganizationPropertyChange, useValue: HandlerOrganizationPropertyChangeMock},
        {provide: HandlerOrganizationAssociationChange, useValue: HandlerOrganizationAssociationChangeMock},
        {provide: HandlerOrganizationDeletion, useValue: HandlerOrganizationDeletionMock},
        {provide: HandlerOrganizationMerge, useValue: HandlerOrganizationMergeMock},
        {provide: HandlerOwnerCreation, useValue: HandlerOwnerCreationMock},
        {provide: HandlerOwnerDeletion, useValue: HandlerOwnerDeletionMock},
        {provide: HandlerOwnerPropertyChange , useValue: HandlerOwnerPropertyChangeMock},
        {provide: CandidatesService, useValue: candidateMock},
        {provide: HandlerDealCreation, useValue: HandlerDealCreationMock},
        {provide: HandlerDealPropertyChange, useValue: HandlerDealPropertyChangeMock},
        {provide: HandlerDealDeletion, useValue: HandlerDealDeletionMock},
        {provide: HandlerDealAssociationChange, useValue: HandlerDealAssociationChangeMock},
        {provide: HireRequestCreationService, useValue: hireRequestCreationServiceMock},
        {provide: HireRequestUpdateService, useValue: hireRequestUpdateServiceMock},
        {provide: HandlerTicketCreation, useValue: HandlerTicketCreationMock},
        {provide: HandlerTicketDeletion, useValue: HandlerTicketDeletionMock},
        {provide: HandlerTicketRestore, useValue: HandlerTicketRestoreMock},
        {provide: HandlerTicketPropertyChange, useValue: HandlerTicketPropertyChangeMock},
        {provide: OrganizationCreationService, useValue: organizationCreationServiceMock},
        {provide: OrganizationUpdateService, useValue: organizationUpdateServiceMock},
        {provide: OwnerCreationService, useValue: ownerCreationServiceMock},
        {provide: ContactCreationService, useValue: contactCreationServiceMock},
        {provide: ContactFromCompanyCreationService, useValue: contactCreationFromCompanyServiceMock},
        {provide: ContactUpdateService, useValue: updateContactServiceMock},
        {provide: ContactDeleteService, useValue: deleteContactServiceMock},
        {provide: CompanyDeleteService, useValue: companyDeleteServiceMock},
        {provide: HandlerAffiliateCreation, useValue: HandlerAffiliateCreationMock},
        {provide: HandlerAffiliatePropertyChange, useValue: HandlerAffiliatePropertyChangeMock},
        {provide: HandlerInvoiceCreation, useValue: HandlerInvoiceCreationMock},
        {provide: HandlerInvoicePropertyChange, useValue: HandlerInvoicePropertyChangeMock},
        {provide: HandlerInvoiceAssociationChange, useValue: HandlerInvoiceAssociationChangeMock},
        {provide: HandlerComissionCreation, useValue: HandlerComissionCreationMock},
        {provide: AffiliateCreationService, useValue: affiliateCreationServiceMock},
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

describe('HubspotService => fetchPropertiesAndCandidates', () => {
  let service: HubspotService;
  const originalEnv = process.env.HUBSPOT_CUSTOM_OBJECT;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubspotService,
        {provide: GoogledriveService, useValue: googleMock},
        {provide: PrismaService, useValue: prismaMock},
        {provide: HandlerObjectCreation, useValue: handlerObjectCreationMock},
        {provide: HandlerObjectPropertyChange, useValue: handlerObjectPropertyChangeMock},
        {provide: HandlerObjectDeletion, useValue: handlerObjectDeletionmock},
        {provide: HandlerObjectMerge, useValue: HandlerObjectMergeMock},
        {provide: HandlerOrganizationCreation, useValue: HandlerOrganizationCreationMock},
        {provide: HandlerOrganizationPropertyChange, useValue: HandlerOrganizationPropertyChangeMock},
        {provide: HandlerOrganizationAssociationChange, useValue: HandlerOrganizationAssociationChangeMock},
        {provide: HandlerOrganizationDeletion, useValue: HandlerOrganizationDeletionMock},
        {provide: HandlerOrganizationMerge, useValue: HandlerOrganizationMergeMock},
        {provide: HandlerOwnerCreation, useValue: HandlerOwnerCreationMock},
        {provide: HandlerOwnerDeletion, useValue: HandlerOwnerDeletionMock},
        {provide: HandlerOwnerPropertyChange , useValue: HandlerOwnerPropertyChangeMock},
        {provide: CandidatesService, useValue: candidateMock},
        {provide: HandlerDealCreation, useValue: HandlerDealCreationMock},
        {provide: HandlerDealPropertyChange, useValue: HandlerDealPropertyChangeMock},
        {provide: HandlerDealDeletion, useValue: HandlerDealDeletionMock},
        {provide: HandlerDealAssociationChange, useValue: HandlerDealAssociationChangeMock},
        {provide: HireRequestCreationService, useValue: hireRequestCreationServiceMock},
        {provide: HireRequestUpdateService, useValue: hireRequestUpdateServiceMock},
        {provide: HandlerTicketCreation, useValue: HandlerTicketCreationMock},
        {provide: HandlerTicketDeletion, useValue: HandlerTicketDeletionMock},
        {provide: HandlerTicketRestore, useValue: HandlerTicketRestoreMock},
        {provide: HandlerTicketPropertyChange, useValue: HandlerTicketPropertyChangeMock},
        {provide: OrganizationCreationService, useValue: organizationCreationServiceMock},
        {provide: OrganizationUpdateService, useValue: organizationUpdateServiceMock},
        {provide: OwnerCreationService, useValue: ownerCreationServiceMock},
        {provide: ContactCreationService, useValue: contactCreationServiceMock},
        {provide: ContactFromCompanyCreationService, useValue: contactCreationFromCompanyServiceMock},
        {provide: ContactUpdateService, useValue: updateContactServiceMock},
        {provide: ContactDeleteService, useValue: deleteContactServiceMock},
        {provide: CompanyDeleteService, useValue: companyDeleteServiceMock},
        {provide: HandlerAffiliateCreation, useValue: HandlerAffiliateCreationMock},
        {provide: HandlerAffiliatePropertyChange, useValue: HandlerAffiliatePropertyChangeMock},
        {provide: HandlerInvoiceCreation, useValue: HandlerInvoiceCreationMock},
        {provide: HandlerInvoicePropertyChange, useValue: HandlerInvoicePropertyChangeMock},
        {provide: HandlerInvoiceAssociationChange, useValue: HandlerInvoiceAssociationChangeMock},
        {provide: HandlerComissionCreation, useValue: HandlerComissionCreationMock},
        {provide: AffiliateCreationService, useValue: affiliateCreationServiceMock},
      ]
    }).compile();

    service = module.get<HubspotService>(HubspotService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.HUBSPOT_CUSTOM_OBJECT = originalEnv;
  });

  it('should throw NotFoundException if HUBSPOT_CUSTOM_OBJECT is not defined', async () => {
    delete process.env.HUBSPOT_CUSTOM_OBJECT;
    await expect(service.fetchPropertiesAndCandidates()).rejects.toThrow(
      'Custom Object is not defined on the environment variables',
    );
  });

  it('should fetch candidates successfully with vaid in properties', async () => {
    process.env.HUBSPOT_CUSTOM_OBJECT = 'custom_obj';
    doSearchMock.mockResolvedValueOnce({
      results: [{ id: '1', properties: {} }],
      paging: { next: { after: 'next_page' } },
    }).mockResolvedValueOnce({
      results: [{ id: '2', properties: {} }],
      paging: undefined,
    });

    const result = await service.fetchPropertiesAndCandidates();
    expect(result).toEqual({
      candidates: [
        { id: '1', properties: {} },
        { id: '2', properties: {} },
      ],
    });

    expect(doSearchMock).toHaveBeenCalledTimes(2);
    expect(doSearchMock).toHaveBeenNthCalledWith(1, 'custom_obj', expect.objectContaining({
      properties: expect.arrayContaining(['vaid']),
    }));
  });
});