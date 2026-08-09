import { HttpException, HttpStatus } from '@nestjs/common';

export class BillComNoDeviceException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message:
          'No MFA device is configured for this Bill.com account. Please set up MFA directly in Bill.com.',
        code: 'BILLCOM_NO_DEVICE',
      },
      HttpStatus.CONFLICT,
    );
  }
}
