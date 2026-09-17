import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ReportAiService } from '@gitroom/nestjs-libraries/report/report.ai.service';
import {
  ReportAskDto,
  ReportGenerateDto,
} from '@gitroom/nestjs-libraries/dtos/report/report.dto';

// Viral Starz: report AI del subaccount corrente (solo lettura, niente pubblicazioni).
@ApiTags('Report')
@Controller('/report')
export class ReportController {
  constructor(private _reportAiService: ReportAiService) {}

  @Post('/generate')
  generate(@GetOrgFromRequest() org: Organization, @Body() body: ReportGenerateDto) {
    return this._reportAiService.generate(org, body.days);
  }

  @Post('/ask')
  async ask(@GetOrgFromRequest() org: Organization, @Body() body: ReportAskDto) {
    try {
      return await this._reportAiService.ask(org, body.sessionId, body.question);
    } catch (e) {
      throw new HttpException((e as Error).message, 400);
    }
  }

  @Get('/job/:id')
  async job(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    const job = await this._reportAiService.job(org, id);
    if (!job) {
      throw new HttpException('Not found', 404);
    }
    return job;
  }
}
