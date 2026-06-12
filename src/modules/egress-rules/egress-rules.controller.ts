import { Request } from 'express';

import { Body, Controller, HttpStatus, Param, Req, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { Endpoint } from '@common/decorators/base-endpoint';
import { Roles } from '@common/decorators/roles/roles';
import { RolesGuard } from '@common/guards/roles';
import {
    CreateEgressRuleCommand,
    UpdateEgressRuleCommand,
    DeleteEgressRuleCommand,
    FindAllEgressRulesCommand,
    ReorderEgressRulesCommand,
    TestEgressRuleCommand,
    CreateProxyOutboundCommand,
    DeleteProxyOutboundCommand,
    GetProxyOutboundsCommand,
    UpdateProxyOutboundCommand,
    TestProxyOutboundCommand,
    CreateProxyGroupCommand,
    DeleteProxyGroupCommand,
    GetProxyGroupsCommand,
    UpdateProxyGroupCommand,
    ExportEgressConfigCommand,
    ImportEgressConfigCommand,
    ImportEgressRuleListCommand,
    CreateProxySubscriptionCommand,
    GetProxySubscriptionsCommand,
    SyncProxySubscriptionCommand,
    DeleteProxySubscriptionCommand,
    UpdateProxySubscriptionCommand,
} from '@libs/contracts/commands';
import { EGRESS_RULES_CONTROLLER, CONTROLLERS_INFO } from '@libs/contracts/api';
import { ROLE } from '@libs/contracts/constants';

import { IJWTAuthPayload } from '@modules/auth/interfaces';

import { NodesQueuesService } from '@queue/_nodes';

import {
    CreateEgressRuleRequestDto,
    CreateEgressRuleResponseDto,
    UpdateEgressRuleRequestDto,
    UpdateEgressRuleResponseDto,
    DeleteEgressRuleRequestDto,
    DeleteEgressRuleResponseDto,
    FindAllEgressRulesResponseDto,
    ReorderEgressRulesRequestDto,
    ReorderEgressRulesResponseDto,
    TestEgressRuleRequestDto,
    TestEgressRuleResponseDto,
    CreateProxyOutboundRequestDto,
    CreateProxyOutboundResponseDto,
    DeleteProxyOutboundRequestDto,
    DeleteProxyOutboundResponseDto,
    GetProxyOutboundsResponseDto,
    UpdateProxyOutboundRequestDto,
    UpdateProxyOutboundResponseDto,
    TestProxyOutboundRequestDto,
    TestProxyOutboundResponseDto,
    CreateProxyGroupRequestDto,
    CreateProxyGroupResponseDto,
    DeleteProxyGroupRequestDto,
    DeleteProxyGroupResponseDto,
    GetProxyGroupsResponseDto,
    UpdateProxyGroupRequestDto,
    UpdateProxyGroupResponseDto,
    ExportEgressConfigRequestDto,
    ExportEgressConfigResponseDto,
    ImportEgressConfigRequestDto,
    ImportEgressConfigResponseDto,
    ImportEgressRuleListRequestDto,
    ImportEgressRuleListResponseDto,
    CreateProxySubscriptionRequestDto,
    CreateProxySubscriptionResponseDto,
    GetProxySubscriptionsResponseDto,
    SyncProxySubscriptionRequestDto,
    SyncProxySubscriptionResponseDto,
    DeleteProxySubscriptionRequestDto,
    DeleteProxySubscriptionResponseDto,
    UpdateProxySubscriptionRequestDto,
    UpdateProxySubscriptionRouteDto,
    UpdateProxySubscriptionResponseDto,
} from './dtos';
import { EgressRulesService } from './egress-rules.service';

@ApiBearerAuth('Authorization')
@ApiTags(CONTROLLERS_INFO.EGRESS_RULES.tag)
@Roles(ROLE.ADMIN)
@UseGuards(JwtDefaultGuard, RolesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(EGRESS_RULES_CONTROLLER)
export class EgressRulesController {
    constructor(
        private readonly egressRulesService: EgressRulesService,
        private readonly nodesQueuesService: NodesQueuesService,
    ) {}

    @Endpoint({
        command: GetProxySubscriptionsCommand,
        httpCode: HttpStatus.OK,
    })
    async findProxySubscriptions(): Promise<GetProxySubscriptionsResponseDto> {
        return {
            response: errorHandler(await this.egressRulesService.findProxySubscriptions()),
        };
    }

    @Endpoint({
        command: CreateProxySubscriptionCommand,
        httpCode: HttpStatus.CREATED,
        apiBody: CreateProxySubscriptionRequestDto,
    })
    async createProxySubscription(
        @Body() body: CreateProxySubscriptionRequestDto,
    ): Promise<CreateProxySubscriptionResponseDto> {
        return {
            response: errorHandler(await this.egressRulesService.createProxySubscription(body)),
        };
    }

    @Endpoint({
        command: UpdateProxySubscriptionCommand,
        httpCode: HttpStatus.OK,
        apiBody: UpdateProxySubscriptionRequestDto,
    })
    async updateProxySubscription(
        @Param() params: UpdateProxySubscriptionRouteDto,
        @Body() body: UpdateProxySubscriptionRequestDto,
    ): Promise<UpdateProxySubscriptionResponseDto> {
        return {
            response: errorHandler(
                await this.egressRulesService.updateProxySubscription(params.uuid, body),
            ),
        };
    }

    @Endpoint({
        command: SyncProxySubscriptionCommand,
        httpCode: HttpStatus.OK,
    })
    async syncProxySubscription(
        @Param() params: SyncProxySubscriptionRequestDto,
    ): Promise<SyncProxySubscriptionResponseDto> {
        return {
            response: errorHandler(
                await this.egressRulesService.syncProxySubscription(params.uuid),
            ),
        };
    }

    @Endpoint({
        command: DeleteProxySubscriptionCommand,
        httpCode: HttpStatus.OK,
    })
    async deleteProxySubscription(
        @Param() params: DeleteProxySubscriptionRequestDto,
    ): Promise<DeleteProxySubscriptionResponseDto> {
        return {
            response: errorHandler(
                await this.egressRulesService.deleteProxySubscription(params.uuid),
            ),
        };
    }

    @Endpoint({
        command: ExportEgressConfigCommand,
        httpCode: HttpStatus.OK,
        apiBody: ExportEgressConfigRequestDto,
    })
    async exportConfig(
        @Body() body: ExportEgressConfigRequestDto,
    ): Promise<ExportEgressConfigResponseDto> {
        return {
            response: errorHandler(await this.egressRulesService.exportConfig(body.includeSecrets)),
        };
    }

    @Endpoint({
        command: ImportEgressConfigCommand,
        httpCode: HttpStatus.OK,
        apiBody: ImportEgressConfigRequestDto,
    })
    async importConfig(
        @Body() body: ImportEgressConfigRequestDto,
        @Req() request: Request,
    ): Promise<ImportEgressConfigResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const data = errorHandler(
            await this.egressRulesService.importConfig(body.backup, actorInfo),
        );
        await this.nodesQueuesService.startAllNodes({ emitter: 'egress-config-import' });
        return { response: data };
    }

    @Endpoint({
        command: GetProxyGroupsCommand,
        httpCode: HttpStatus.OK,
    })
    async findProxyGroups(): Promise<GetProxyGroupsResponseDto> {
        return { response: errorHandler(await this.egressRulesService.findProxyGroups()) };
    }

    @Endpoint({
        command: CreateProxyGroupCommand,
        httpCode: HttpStatus.CREATED,
        apiBody: CreateProxyGroupRequestDto,
    })
    async createProxyGroup(
        @Body() body: CreateProxyGroupRequestDto,
        @Req() request: Request,
    ): Promise<CreateProxyGroupResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const data = errorHandler(await this.egressRulesService.createProxyGroup(body, actorInfo));
        await this.nodesQueuesService.startAllNodes({ emitter: 'proxy-group-create' });
        return { response: data };
    }

    @Endpoint({
        command: UpdateProxyGroupCommand,
        httpCode: HttpStatus.OK,
        apiBody: UpdateProxyGroupRequestDto,
    })
    async updateProxyGroup(
        @Body() body: UpdateProxyGroupRequestDto,
        @Req() request: Request,
    ): Promise<UpdateProxyGroupResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const data = errorHandler(await this.egressRulesService.updateProxyGroup(body, actorInfo));
        await this.nodesQueuesService.startAllNodes({ emitter: 'proxy-group-update' });
        return { response: data };
    }

    @Endpoint({
        command: DeleteProxyGroupCommand,
        httpCode: HttpStatus.OK,
    })
    async deleteProxyGroup(
        @Param() params: DeleteProxyGroupRequestDto,
        @Req() request: Request,
    ): Promise<DeleteProxyGroupResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const data = errorHandler(
            await this.egressRulesService.deleteProxyGroup(params.uuid, actorInfo),
        );
        await this.nodesQueuesService.startAllNodes({ emitter: 'proxy-group-delete' });
        return { response: data };
    }

    @Endpoint({
        command: GetProxyOutboundsCommand,
        httpCode: HttpStatus.OK,
    })
    async findProxyOutbounds(): Promise<GetProxyOutboundsResponseDto> {
        const result = await this.egressRulesService.findProxyOutbounds();
        return { response: errorHandler(result) };
    }

    @Endpoint({
        command: TestProxyOutboundCommand,
        httpCode: HttpStatus.OK,
        apiBody: TestProxyOutboundRequestDto,
    })
    async testProxyOutbound(
        @Body() body: TestProxyOutboundRequestDto,
    ): Promise<TestProxyOutboundResponseDto> {
        const result = await this.egressRulesService.testProxyOutbound(body.uuid);
        return { response: errorHandler(result) };
    }

    @Endpoint({
        command: CreateProxyOutboundCommand,
        httpCode: HttpStatus.CREATED,
        apiBody: CreateProxyOutboundRequestDto,
    })
    async createProxyOutbound(
        @Body() body: CreateProxyOutboundRequestDto,
        @Req() request: Request,
    ): Promise<CreateProxyOutboundResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.createProxyOutbound(body, actorInfo);
        const data = errorHandler(result);
        await this.nodesQueuesService.startAllNodes({ emitter: 'proxy-outbound-create' });
        return { response: data };
    }

    @Endpoint({
        command: UpdateProxyOutboundCommand,
        httpCode: HttpStatus.OK,
        apiBody: UpdateProxyOutboundRequestDto,
    })
    async updateProxyOutbound(
        @Body() body: UpdateProxyOutboundRequestDto,
        @Req() request: Request,
    ): Promise<UpdateProxyOutboundResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.updateProxyOutbound(body, actorInfo);
        const data = errorHandler(result);
        await this.nodesQueuesService.startAllNodes({ emitter: 'proxy-outbound-update' });
        return { response: data };
    }

    @Endpoint({
        command: DeleteProxyOutboundCommand,
        httpCode: HttpStatus.OK,
    })
    async deleteProxyOutbound(
        @Param() params: DeleteProxyOutboundRequestDto,
        @Req() request: Request,
    ): Promise<DeleteProxyOutboundResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.deleteProxyOutbound(params.uuid, actorInfo);
        const data = errorHandler(result);
        await this.nodesQueuesService.startAllNodes({ emitter: 'proxy-outbound-delete' });
        return { response: data };
    }

    @ApiResponse({
        status: 201,
        description: 'Egress rule created successfully',
        type: CreateEgressRuleResponseDto,
    })
    @Endpoint({
        command: CreateEgressRuleCommand,
        httpCode: HttpStatus.CREATED,
        apiBody: CreateEgressRuleRequestDto,
    })
    async create(
        @Body() body: CreateEgressRuleRequestDto,
        @Req() request: Request,
    ): Promise<CreateEgressRuleResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.create(body, actorInfo);
        const data = errorHandler(result);
        await this.nodesQueuesService.startAllNodes({ emitter: 'egress-rule-create' });
        return { response: data };
    }

    @ApiResponse({
        status: 201,
        description: 'Egress rule list imported successfully',
        type: ImportEgressRuleListResponseDto,
    })
    @Endpoint({
        command: ImportEgressRuleListCommand,
        httpCode: HttpStatus.CREATED,
        apiBody: ImportEgressRuleListRequestDto,
    })
    async importRuleList(
        @Body() body: ImportEgressRuleListRequestDto,
        @Req() request: Request,
    ): Promise<ImportEgressRuleListResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.importRuleList(body, actorInfo);
        const data = errorHandler(result);
        if (!body.dryRun) {
            await this.nodesQueuesService.startAllNodes({ emitter: 'egress-rule-list-import' });
        }
        return { response: data };
    }

    @ApiResponse({
        status: 200,
        description: 'Egress rules fetched successfully',
        type: FindAllEgressRulesResponseDto,
    })
    @Endpoint({
        command: FindAllEgressRulesCommand,
        httpCode: HttpStatus.OK,
    })
    async findAll(): Promise<FindAllEgressRulesResponseDto> {
        const result = await this.egressRulesService.findAll();
        const data = errorHandler(result);
        return { response: data };
    }

    @ApiResponse({
        status: 200,
        description: 'Egress rule updated successfully',
        type: UpdateEgressRuleResponseDto,
    })
    @Endpoint({
        command: UpdateEgressRuleCommand,
        httpCode: HttpStatus.OK,
        apiBody: UpdateEgressRuleRequestDto,
    })
    async update(
        @Body() body: UpdateEgressRuleRequestDto,
        @Req() request: Request,
    ): Promise<UpdateEgressRuleResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.update(body, actorInfo);
        const data = errorHandler(result);
        await this.nodesQueuesService.startAllNodes({ emitter: 'egress-rule-update' });
        return { response: data };
    }

    @ApiParam({ name: 'uuid', type: String, description: 'UUID of the egress rule' })
    @ApiResponse({
        status: 200,
        description: 'Egress rule deleted successfully',
        type: DeleteEgressRuleResponseDto,
    })
    @Endpoint({
        command: DeleteEgressRuleCommand,
        httpCode: HttpStatus.OK,
    })
    async delete(
        @Param() paramData: DeleteEgressRuleRequestDto,
        @Req() request: Request,
    ): Promise<DeleteEgressRuleResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.delete(paramData.uuid, actorInfo);
        const data = errorHandler(result);
        await this.nodesQueuesService.startAllNodes({ emitter: 'egress-rule-delete' });
        return { response: data };
    }

    @ApiResponse({
        status: 200,
        description: 'Egress rules reordered successfully',
        type: ReorderEgressRulesResponseDto,
    })
    @Endpoint({
        command: ReorderEgressRulesCommand,
        httpCode: HttpStatus.OK,
        apiBody: ReorderEgressRulesRequestDto,
    })
    async reorder(
        @Body() body: ReorderEgressRulesRequestDto,
        @Req() request: Request,
    ): Promise<ReorderEgressRulesResponseDto> {
        const actor = request.user as IJWTAuthPayload | undefined;
        const actorInfo =
            actor && actor.uuid ? { uuid: actor.uuid, username: actor.username } : undefined;
        const result = await this.egressRulesService.reorder(body.uuids, actorInfo);
        const data = errorHandler(result);
        await this.nodesQueuesService.startAllNodes({ emitter: 'egress-rule-reorder' });
        return { response: data };
    }

    @ApiResponse({
        status: 200,
        description: 'Egress rule matching tested successfully',
        type: TestEgressRuleResponseDto,
    })
    @Endpoint({
        command: TestEgressRuleCommand,
        httpCode: HttpStatus.OK,
        apiBody: TestEgressRuleRequestDto,
    })
    async testRule(@Body() body: TestEgressRuleRequestDto): Promise<TestEgressRuleResponseDto> {
        const result = await this.egressRulesService.testRule(body.pattern);
        const data = errorHandler(result);
        return { response: data };
    }
}
