import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppService {
  
  getHello(): string {
    return 'Hello from AppService Updated 2!!';
  }

}
