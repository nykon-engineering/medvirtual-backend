
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CandidatesService } from '../src/candidate/candidates.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const candidatesService = app.get(CandidatesService);
    const prismaService = app.get(PrismaService);

    try {
        const candidateId = 'd86fc0e6-baae-4f01-ab23-04d639119c70';
        console.log(`Using candidate ID: ${candidateId}`);

        const candidate = await prismaService.candidate.findUnique({
            where: { id: candidateId }
        });

        if (!candidate) {
            console.error(`Candidate ${candidateId} not found.`);
            process.exit(1);
        }

        console.log(`Found candidate: ${candidate.first_name} ${candidate.last_name}`);
        console.log(`Resume URL: ${candidate.resume_url}`);

        console.log('Triggering processData...');
        const result = await candidatesService.processData(candidate.id);

        if (result) {
            console.log('processData completed successfully.');
        } else {
            console.error('processData returned false.');
        }

    } catch (error) {
        console.error('Error running test:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
