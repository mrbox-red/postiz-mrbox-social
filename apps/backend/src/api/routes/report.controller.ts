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
  ReportChatDto,
  ReportGenerateDto,
} from '@gitroom/nestjs-libraries/dtos/report/report.dto';

// Viral Starz: agente AI (Claude) del subaccount corrente: report e chat sui dati, solo lettura.
@ApiTags('Report')
@Controller('/report')
export class ReportController {
  constructor(private _reportAiService: ReportAiService) {}

  @Post('/generate')
  generate(@GetOrgFromRequest() org: Organization, @Body() body: ReportGenerateDto) {
    return this._reportAiService.generate(org, body.days);
  }

  @Post('/chat')
  async chat(@GetOrgFromRequest() org: Organization, @Body() body: ReportChatDto) {
    try {
      return await this._reportAiService.chat(org, body.message, body.days, body.sessionId);
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
