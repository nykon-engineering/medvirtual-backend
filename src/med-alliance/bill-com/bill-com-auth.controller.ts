import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { USER } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ADMIN_ROLES } from '../constants';
import { PrismaService } from '../../prisma/prisma.service';
import { BillComService } from './bill-com.service';
import { BillComAuthService } from './bill-com-auth.service';
import { BillComLoginDto } from './dto/bill-com-login.dto';
import { BillComMfaValidateDto } from './dto/bill-com-mfa-validate.dto';
import { BillComPhoneSetupDto } from './dto/bill-com-phone-setup.dto';
import { BillComPhoneValidateDto } from './dto/bill-com-phone-validate.dto';

@ApiTags('med-alliance')
@ApiBearerAuth()
@Controller('med-alliance/admin/bill-com')
@UseGuards(AuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class BillComAuthController {
  constructor(
    private readonly billComService: BillComService,
    private readonly billComAuthService: BillComAuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async requirePendingSessionId(userId: string): Promise<string> {
    const user = await this.prisma.uSER.findUniqueOrThrow({
      where: { id: userId },
      select: { billcom_pending_session_id: true },
    });
    if (!user.billcom_pending_session_id) {
      throw new BadRequestException(
        'No Bill.com login in progress. Please sign in again.',
      );
    }
    return user.billcom_pending_session_id;
  }

  @Get('status')
  @ApiOperation({ summary: "Check whether the admin's Bill.com session is valid" })
  @ApiResponse({ status: 200, description: 'Session status' })
  async status(@CurrentUser() admin: USER) {
    const connected = await this.billComService.hasValidSession(admin.id);
    return { connected };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: "Sign in with the admin's own Bill.com credentials" })
  @ApiResponse({ status: 200, description: 'trusted + nextStep' })
  @ApiResponse({ status: 502, description: 'Bill.com API error' })
  async login(@CurrentUser() admin: USER, @Body() dto: BillComLoginDto) {
    const result = await this.billComService.login(admin.id, {
      username: dto.email,
      password: dto.password,
    });
    const nextStep = await this.billComAuthService.determineNextStep(
      admin.id,
      result,
    );
    return { trusted: result.trusted, nextStep };
  }

  @Post('mfa/challenge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request an MFA challenge (SMS code)' })
  @ApiResponse({ status: 200, description: 'challengeId' })
  async mfaChallenge(@CurrentUser() admin: USER) {
    const sessionId = await this.requirePendingSessionId(admin.id);
    return this.billComService.requestMfaChallenge(admin.id, sessionId);
  }

  @Post('mfa/validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate the MFA code sent to the registered device' })
  @ApiResponse({ status: 200, description: 'success' })
  async mfaValidate(
    @CurrentUser() admin: USER,
    @Body() dto: BillComMfaValidateDto,
  ) {
    const sessionId = await this.requirePendingSessionId(admin.id);
    await this.billComService.validateMfaChallenge(
      admin.id,
      sessionId,
      dto.challengeId,
      dto.token,
    );
    return { success: true };
  }

  @Post('phone/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register a phone number for MFA (first-time setup)' })
  @ApiResponse({ status: 200, description: 'setupId' })
  async phoneSetup(
    @CurrentUser() admin: USER,
    @Body() dto: BillComPhoneSetupDto,
  ) {
    const sessionId = await this.requirePendingSessionId(admin.id);
    return this.billComService.addPhoneForMfaSetup(
      admin.id,
      sessionId,
      dto.phone,
    );
  }

  @Post('phone/validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm the code sent to the newly registered phone' })
  @ApiResponse({ status: 200, description: 'success' })
  async phoneValidate(
    @CurrentUser() admin: USER,
    @Body() dto: BillComPhoneValidateDto,
  ) {
    const sessionId = await this.requirePendingSessionId(admin.id);
    await this.billComService.validatePhoneForMfaSetup(
      admin.id,
      sessionId,
      dto.setupId,
      dto.token,
    );
    return { success: true };
  }
}
