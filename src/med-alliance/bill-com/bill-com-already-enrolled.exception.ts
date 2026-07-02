import { HttpException, HttpStatus } from '@nestjs/common';

export class BillComAlreadyEnrolledException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message:
          'This Bill.com account already has a registered MFA device. Please verify with the existing device instead.',
        code: 'BILLCOM_ALREADY_ENROLLED',
      },
      HttpStatus.CONFLICT,
    );
  }
}
