import { EgressRules } from '@prisma/client';

import { Injectable } from '@nestjs/common';

import { UniversalConverter } from '@common/converter/universalConverter';

import { EgressRuleEntity } from './entities/egress-rule.entity';

const modelToEntity = (model: EgressRules): EgressRuleEntity => {
    return new EgressRuleEntity(model);
};

const entityToModel = (entity: EgressRuleEntity): EgressRules => {
    return {
        uuid: entity.uuid,
        viewPosition: entity.viewPosition,
        name: entity.name,
        description: entity.description,
        pattern: entity.pattern,
        action: entity.action,
        isEnabled: entity.isEnabled,
        targetUsers: entity.targetUsers,
        proxyOutboundUuid: entity.proxyOutboundUuid,
        proxyGroupUuid: entity.proxyGroupUuid,
        validFrom: entity.validFrom,
        expiresAt: entity.expiresAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
    };
};

@Injectable()
export class EgressRuleConverter extends UniversalConverter<EgressRuleEntity, EgressRules> {
    constructor() {
        super(modelToEntity, entityToModel);
    }
}
