import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { SubaccountDto } from '@gitroom/nestjs-libraries/dtos/agency/subaccount.dto';

// Viral Starz: livello "agenzia" (account principale + subaccount).
// Un subaccount è un'Organization; lo gestisce solo l'utente con isSuperAdmin.
@ApiTags('Agency')
@Controller('/agency')
export class AgencyController {
  constructor(private _organizationService: OrganizationService) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  @Get('/subaccounts')
  async list(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._organizationService.getAllOrganizations(user.id);
  }

  @Post('/subaccounts')
  async create(
    @GetUserFromRequest() user: User,
    @Body() body: SubaccountDto
  ) {
    this.assertSuperAdmin(user);
    return this._organizationService.createSubaccount(body.name, user.id);
  }

  @Put('/subaccounts/:id')
  async rename(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: SubaccountDto
  ) {
    this.assertSuperAdmin(user);
    return this._organizationService.renameSubaccount(id, body.name);
  }

  @Post('/subaccounts/:id/enter')
  async enter(@GetUserFromRequest() user: User, @Param('id') id: string) {
    this.assertSuperAdmin(user);
    return this._organizationService.enterSubaccount(user.id, id);
  }

  @Delete('/subaccounts/:id')
  async archive(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    return this._organizationService.archiveSubaccount(id, org.id);
  }
}
