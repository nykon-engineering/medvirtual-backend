import { Injectable } from "@nestjs/common";
import { HandlerOrganizationAssociationChange } from "./organizationAssociationChange";

@Injectable()

export class HandlerDealAssociationChange {

    constructor(
        private readonly organizationAssociationChange: HandlerOrganizationAssociationChange,
    ){}

    async execute(event){
        
        switch (event.associationType) {
               
            case 'DEAL_TO_COMPANY':
                
                //HERE I JUST REVERT THE IDS TO REUSE THE SAME LOGIC ON 'COMPANY_TO_DEAL'
                const tempId = event.fromObjectId;
                event.fromObjectId = event.toObjectId;
                event.toObjectId = tempId;
                event.associationType = 'COMPANY_TO_DEAL'

                await this.organizationAssociationChange.execute(event);

                break;
            case 'DEAL_TO_CONTACT':
            
                break;
            
            case 'DEAL_TO_DEAL':
            
                break;

            case 'DEAL_TO_TICKET':
            
                break;

            //Here i need to figured out the case for association betweend staff and candidates;
        }

       

        return true;
    }
}