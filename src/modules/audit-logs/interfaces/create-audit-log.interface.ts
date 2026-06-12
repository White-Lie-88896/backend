import { AuditActorType, AuditResult } from '@libs/contracts/models';

export interface CreateAuditLog {
    actorType: AuditActorType;
    actorId?: string | null;
    actorName?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    result: AuditResult;
    message?: string | null;
    metadata?: unknown;
}
