import { Request } from 'express';

import { CONTROLLERS_INFO, NODES_CONTROLLER } from '@contract/api';
import { ROLE } from '@contract/constants';

import {
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { Body, Controller, HttpStatus, Param, Req, UseFilters, UseGuards } from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { RolesGuard } from '@common/guards/roles/roles.guard';
import { UserAgent } from '@common/decorators/get-useragent/get-useragent';
import { IpAddress } from '@common/decorators/get-ip/get-ip';
import { Endpoint } from '@common/decorators/base-endpoint';
import { Roles } from '@common/decorators/roles/roles';
import {
    CreateNodeCommand,
    DeleteNodeCommand,
    DisableNodeCommand,
    EnableNodeCommand,
    GetAllNodesCommand,
    GetAllNodesTagsCommand,
    GetOneNodeCommand,
    BulkNodesProfileModificationCommand,
    ReorderNodeCommand,
    ResetNodeTrafficCommand,
    RestartAllNodesCommand,
    RestartNodeCommand,
    UpdateNodeCommand,
    BulkNodesActionsCommand,
    BulkNodesUpdateCommand,
} from '@libs/contracts/commands';

import {
    BulkNodesActionsRequestDto,
    BulkNodesActionsResponseDto,
    BulkNodesUpdateRequestDto,
    BulkNodesUpdateResponseDto,
    CreateNodeRequestDto,
    CreateNodeResponseDto,
    DeleteNodeRequestParamDto,
    DeleteNodeResponseDto,
    DisableNodeRequestParamDto,
    DisableNodeResponseDto,
    EnableNodeResponseDto,
    GetAllNodesResponseDto,
    GetAllNodesTagsResponseDto,
    GetOneNodeRequestParamDto,
    GetOneNodeResponseDto,
    ProfileModificationRequestDto,
    ProfileModificationResponseDto,
    ReorderNodeRequestDto,
    ReorderNodeResponseDto,
    ResetNodeTrafficRequestDto,
    ResetNodeTrafficResponseDto,
    RestartAllNodesRequestBodyDto,
    RestartAllNodesResponseDto,
    RestartNodeRequestDto,
    RestartNodeResponseDto,
    UpdateNodeRequestDto,
    UpdateNodeResponseDto,
} from './dtos';
import { GetAllNodesTagsResponseModel } from './models';
import { EnableNodeRequestParamDto } from './dtos';
import { NodesService } from './nodes.service';

import { IJWTAuthPayload } from '@modules/auth/interfaces';
import { AuditLogsService } from '@modules/audit-logs';

@ApiBearerAuth('Authorization')
@ApiTags(CONTROLLERS_INFO.NODES.tag)
@Roles(ROLE.ADMIN, ROLE.API)
@UseGuards(JwtDefaultGuard, RolesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(NODES_CONTROLLER)
export class NodesController {
    constructor(
        private readonly nodesService: NodesService,
        private readonly auditLogsService: AuditLogsService,
    ) {}

    @ApiOkResponse({
        type: GetAllNodesTagsResponseDto,
        description: 'Nodes tags fetched',
    })
    @Endpoint({
        command: GetAllNodesTagsCommand,
        httpCode: HttpStatus.OK,
    })
    async getAllNodesTags(): Promise<GetAllNodesTagsResponseDto> {
        const res = await this.nodesService.getAllNodesTags();
        const data = errorHandler(res);
        return {
            response: new GetAllNodesTagsResponseModel(data),
        };
    }

    @ApiCreatedResponse({
        type: CreateNodeResponseDto,
        description: 'Node created successfully',
    })
    @Endpoint({
        command: CreateNodeCommand,
        httpCode: HttpStatus.CREATED,
        apiBody: CreateNodeRequestDto,
    })
    async createNode(
        @Body() body: CreateNodeRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<CreateNodeResponseDto> {
        const result = await this.nodesService.createNode(body);

        await this.auditNodeOperation(request, {
            action: 'node.create',
            resourceId: result.isOk ? result.response.uuid : null,
            resourceName: body.name,
            ip,
            userAgent,
            success: result.isOk,
        });

        const data = errorHandler(result);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: GetAllNodesResponseDto,
        description: 'Nodes fetched',
    })
    @Endpoint({
        command: GetAllNodesCommand,
        httpCode: HttpStatus.OK,
    })
    async getAllNodes(): Promise<GetAllNodesResponseDto> {
        const res = await this.nodesService.getAllNodes();
        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: GetOneNodeResponseDto,
        description: 'Node fetched',
    })
    @ApiParam({ name: 'uuid', type: String, description: 'Node UUID' })
    @Endpoint({
        command: GetOneNodeCommand,
        httpCode: HttpStatus.OK,
    })
    async getOneNode(@Param() uuid: GetOneNodeRequestParamDto): Promise<GetOneNodeResponseDto> {
        const res = await this.nodesService.getOneNode(uuid.uuid);
        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: EnableNodeResponseDto,
        description: 'Node enabled',
    })
    @ApiParam({ name: 'uuid', type: String, description: 'Node UUID' })
    @Endpoint({
        command: EnableNodeCommand,
        httpCode: HttpStatus.OK,
    })
    async enableNode(
        @Param() uuid: EnableNodeRequestParamDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<EnableNodeResponseDto> {
        const res = await this.nodesService.enableNode(uuid.uuid);

        await this.auditNodeOperation(request, {
            action: 'node.enable',
            resourceId: uuid.uuid,
            resourceName: res.isOk ? res.response.name : null,
            ip,
            userAgent,
            success: res.isOk,
        });

        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: DisableNodeResponseDto,
        description: 'Node disabled',
    })
    @ApiParam({ name: 'uuid', type: String, description: 'Node UUID' })
    @Endpoint({
        command: DisableNodeCommand,
        httpCode: HttpStatus.OK,
    })
    async disableNode(
        @Param() uuid: DisableNodeRequestParamDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<DisableNodeResponseDto> {
        const res = await this.nodesService.disableNode(uuid.uuid);

        await this.auditNodeOperation(request, {
            action: 'node.disable',
            resourceId: uuid.uuid,
            resourceName: res.isOk ? res.response.name : null,
            ip,
            userAgent,
            success: res.isOk,
        });

        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: DeleteNodeResponseDto,
        description: 'Node deleted',
    })
    @ApiParam({ name: 'uuid', type: String, description: 'Node UUID' })
    @Endpoint({
        command: DeleteNodeCommand,
        httpCode: HttpStatus.OK,
    })
    async deleteNode(
        @Param() uuid: DeleteNodeRequestParamDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<DeleteNodeResponseDto> {
        const res = await this.nodesService.deleteNode(uuid.uuid);

        await this.auditNodeOperation(request, {
            action: 'node.delete',
            resourceId: uuid.uuid,
            resourceName: null,
            ip,
            userAgent,
            success: res.isOk,
        });

        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: UpdateNodeResponseDto,
        description: 'Node updated',
    })
    @Endpoint({
        command: UpdateNodeCommand,
        httpCode: HttpStatus.OK,
        apiBody: UpdateNodeRequestDto,
    })
    async updateNode(
        @Body() body: UpdateNodeRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<UpdateNodeResponseDto> {
        const res = await this.nodesService.updateNode(body);

        await this.auditNodeOperation(request, {
            action: 'node.update',
            resourceId: res.isOk ? res.response.uuid : (body.uuid ?? null),
            resourceName: res.isOk ? res.response.name : (body.name ?? null),
            ip,
            userAgent,
            success: res.isOk,
        });

        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: RestartNodeResponseDto,
        description: 'Node restarted',
    })
    @ApiParam({ name: 'uuid', type: String, description: 'Node UUID' })
    @Endpoint({
        command: RestartNodeCommand,
        httpCode: HttpStatus.OK,
    })
    async restartNode(
        @Param() uuid: RestartNodeRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<RestartNodeResponseDto> {
        const res = await this.nodesService.restartNode(uuid.uuid);

        await this.auditNodeOperation(request, {
            action: 'node.restart',
            resourceId: uuid.uuid,
            resourceName: null,
            ip,
            userAgent,
            success: res.isOk,
        });

        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: ResetNodeTrafficResponseDto,
        description: 'Event sent',
    })
    @ApiParam({ name: 'uuid', type: String, description: 'Node UUID' })
    @Endpoint({
        command: ResetNodeTrafficCommand,
        httpCode: HttpStatus.OK,
    })
    async resetNodeTraffic(
        @Param() uuid: ResetNodeTrafficRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<ResetNodeTrafficResponseDto> {
        const res = await this.nodesService.resetNodeTraffic(uuid.uuid);

        await this.auditNodeOperation(request, {
            action: 'node.reset_traffic',
            resourceId: uuid.uuid,
            resourceName: null,
            ip,
            userAgent,
            success: res.isOk,
        });

        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: RestartAllNodesResponseDto,
        description: 'All nodes restarted',
    })
    @Endpoint({
        command: RestartAllNodesCommand,
        httpCode: HttpStatus.OK,
    })
    async restartAllNodes(
        @Body() { forceRestart }: RestartAllNodesRequestBodyDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<RestartAllNodesResponseDto> {
        const res = await this.nodesService.restartAllNodes(forceRestart);

        await this.auditNodeOperation(request, {
            action: 'node.restart_all',
            resourceId: null,
            resourceName: forceRestart ? 'force' : 'graceful',
            ip,
            userAgent,
            success: res.isOk,
        });

        const data = errorHandler(res);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: ReorderNodeResponseDto,
        description: 'Nodes reordered successfully',
    })
    @Endpoint({
        command: ReorderNodeCommand,
        httpCode: HttpStatus.OK,
        apiBody: ReorderNodeRequestDto,
    })
    async reorderNodes(
        @Body() body: ReorderNodeRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<ReorderNodeResponseDto> {
        const result = await this.nodesService.reorderNodes(body);

        await this.auditNodeOperation(request, {
            action: 'node.reorder',
            resourceId: null,
            resourceName: null,
            ip,
            userAgent,
            success: result.isOk,
        });

        const data = errorHandler(result);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: ProfileModificationResponseDto,
        description: 'Event sent successfully',
    })
    @Endpoint({
        command: BulkNodesProfileModificationCommand,
        httpCode: HttpStatus.OK,
        apiBody: ProfileModificationRequestDto,
    })
    async profileModification(
        @Body() body: ProfileModificationRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<ProfileModificationResponseDto> {
        const result = await this.nodesService.profileModification(body);

        await this.auditNodeOperation(request, {
            action: 'node.profile_modification',
            resourceId: null,
            resourceName: body.configProfile?.activeConfigProfileUuid ?? null,
            ip,
            userAgent,
            success: result.isOk,
        });

        const data = errorHandler(result);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: BulkNodesActionsResponseDto,
        description: 'Event sent successfully',
    })
    @Endpoint({
        command: BulkNodesActionsCommand,
        httpCode: HttpStatus.OK,
        apiBody: BulkNodesActionsRequestDto,
    })
    async bulkNodesActions(
        @Body() body: BulkNodesActionsRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<BulkNodesActionsResponseDto> {
        const result = await this.nodesService.bulkNodesActions(body);

        await this.auditNodeOperation(request, {
            action: 'node.bulk_actions',
            resourceId: null,
            resourceName: body.action,
            ip,
            userAgent,
            success: result.isOk,
        });

        const data = errorHandler(result);
        return {
            response: data,
        };
    }

    @ApiOkResponse({
        type: BulkNodesUpdateResponseDto,
        description: 'Event sent successfully',
    })
    @Endpoint({
        command: BulkNodesUpdateCommand,
        httpCode: HttpStatus.OK,
        apiBody: BulkNodesUpdateRequestDto,
    })
    async bulkNodesUpdate(
        @Body() body: BulkNodesUpdateRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<BulkNodesUpdateResponseDto> {
        const result = await this.nodesService.bulkNodesUpdate(body);

        await this.auditNodeOperation(request, {
            action: 'node.bulk_update',
            resourceId: null,
            resourceName: null,
            ip,
            userAgent,
            success: result.isOk,
        });

        const data = errorHandler(result);
        return {
            response: data,
        };
    }

    private async auditNodeOperation(
        request: Request,
        operation: {
            action: string;
            resourceId: string | null;
            resourceName: string | null;
            ip: string;
            userAgent: string;
            success: boolean;
        },
    ): Promise<void> {
        const actor = request.user as IJWTAuthPayload | undefined;

        await this.auditLogsService.createLog({
            actorType: actor?.role === ROLE.API ? 'system' : 'admin',
            actorId: actor?.uuid,
            actorName: actor?.username ?? (actor?.role === ROLE.API ? 'API token' : null),
            action: operation.action,
            resourceType: 'node',
            resourceId: operation.resourceId,
            ip: operation.ip,
            userAgent: operation.userAgent,
            result: operation.success ? 'success' : 'failed',
            message: operation.success
                ? `${operation.action} succeeded.`
                : `${operation.action} failed.`,
            metadata: operation.resourceName
                ? {
                      nodeName: operation.resourceName,
                  }
                : undefined,
        });
    }
}
