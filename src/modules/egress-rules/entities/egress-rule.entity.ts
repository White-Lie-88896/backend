import { EgressRules } from '@prisma/client';

import { EgressRuleAction } from '@libs/contracts/models';

export class EgressRuleEntity implements EgressRules {
    public uuid: string;
    public viewPosition: number;
    public name: string;
    public description: string | null;
    public pattern: string;
    public action: EgressRuleAction;
    public isEnabled: boolean;
    public targetUsers: number[] | null;
    public proxyOutboundUuid: string | null;
    public proxyGroupUuid: string | null;
    public validFrom: Date | null;
    public expiresAt: Date | null;
    public trafficUplinkBytes = '0';
    public trafficDownlinkBytes = '0';
    public trafficTotalBytes = '0';
    public trafficHitCount = '0';
    public lastTrafficHitAt: Date | null = null;

    public createdAt: Date;
    public updatedAt: Date;

    constructor(egressRule: Partial<EgressRules>) {
        Object.assign(this, egressRule);
        return this;
    }
}
