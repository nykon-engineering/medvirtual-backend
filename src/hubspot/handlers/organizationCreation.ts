import { Injectable } from "@nestjs/common";


@Injectable()

export class HandlerOrganizationCreation {
    constructor() {}

    async execute(event){
        console.log("Handling organization creation event:", event);
        // Add your logic to handle organization creation here
    }
}