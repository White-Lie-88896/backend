import { AuditLogs, Prisma } from '@prisma/client';

import { AuditActorType, AuditResult } from '@libs/contracts/models';

export class AuditLogEntity implements AuditLogs {
    id: string;
    createdAt: Date;
    actorType: AuditActorType;
    actorId: string | null;
    actorName: string | null;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    ip: string | null;
    userAgent: string | null;
    result: AuditResult;
    message: string | null;
    metadata: Prisma.JsonValue | null;

    constructor(data: Partial<AuditLogs>) {
        Object.assign(this, data);
    }
}
