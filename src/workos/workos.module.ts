import { Module } from '@nestjs/common';
import { WorkosService } from './workos.service';

@Module({
    providers: [WorkosService],
    exports: [WorkosService],
})
export class WorkosModule {}
