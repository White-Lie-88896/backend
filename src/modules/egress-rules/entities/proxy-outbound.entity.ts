import { ProxyOutboundConfig } from '@libs/contracts/models';

export class ProxyOutboundEntity {
    public uuid: string;
    public name: string;
    public description: string | null;
    public config: ProxyOutboundConfig;
    public isEnabled: boolean;
    public healthStatus: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
    public lastLatencyMs: number | null;
    public lastHealthMessage: string | null;
    public lastHealthCheckAt: Date | null;
    public subscriptionUuid: string | null;
    public sourceKey: string | null;
    public distributionMode: 'INHERIT' | 'NONE' | 'ALL' | 'SELECTED';
    public targetUserIds: number[];
    public targetSquadUuids: string[];
    public createdAt: Date;
    public updatedAt: Date;

    constructor(data: Partial<ProxyOutboundEntity>) {
        Object.assign(this, data);
    }
}
