import { HttpException, HttpStatus } from '@nestjs/common';

export class BillComSessionRequiredException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message:
          'You need to sign in to your Bill.com account before completing this payment.',
        code: 'BILLCOM_SESSION_REQUIRED',
      },
      HttpStatus.CONFLICT,
    );
  }
}
