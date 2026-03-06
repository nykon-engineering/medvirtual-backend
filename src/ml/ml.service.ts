import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvokeCommand, LambdaClient, InvokeCommandOutput } from '@aws-sdk/client-lambda';

export interface MLInferenceRequest {
  modelName: string;
  input: number[] | number[][];
  metadata?: Record<string, unknown>;
}

export interface MLInferenceResponse {
  predictions: number[][];
  modelName: string;
  inferenceTimeMs: number;
}

@Injectable()
export class MLService {
  private readonly logger = new Logger(MLService.name);
  private readonly lambdaClient: LambdaClient;
  private readonly functionName: string;

  constructor(private readonly configService: ConfigService) {
    this.lambdaClient = new LambdaClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });
    this.functionName = this.configService.getOrThrow('ML_LAMBDA_FUNCTION_NAME');
  }

  async infer(request: MLInferenceRequest): Promise<MLInferenceResponse> {
    this.logger.log(`Invoking ML Lambda: model=${request.modelName}`);

    const command = new InvokeCommand({
      FunctionName: this.functionName,
      Payload: Buffer.from(JSON.stringify(request)),
    });

    const response: InvokeCommandOutput = await this.lambdaClient.send(command);
    const rawPayload = Buffer.from(response.Payload!).toString();

    if (response.FunctionError) {
      const error = JSON.parse(rawPayload);
      this.logger.error(`ML Lambda error: ${error.errorMessage}`);
      throw new Error(`ML inference failed: ${error.errorMessage}`);
    }

    return JSON.parse(rawPayload) as MLInferenceResponse;
  }
}
