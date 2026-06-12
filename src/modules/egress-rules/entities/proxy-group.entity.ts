import { ProxyGroups } from '@prisma/client';

import { ProxyGroupMode } from '@libs/contracts/models';

export class ProxyGroupEntity implements Omit<ProxyGroups, 'outboundUuids' | 'mode'> {
    public uuid: string;
    public name: string;
    public description: string | null;
    public mode: ProxyGroupMode;
    public outboundUuids: string[];
    public isEnabled: boolean;
    public createdAt: Date;
    public updatedAt: Date;

    constructor(group: Partial<ProxyGroupEntity>) {
        Object.assign(this, group);
    }
}
