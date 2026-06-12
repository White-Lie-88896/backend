import { z } from 'zod';

export const AUDIT_ACTOR_TYPES = ['admin', 'user', 'node', 'system', 'agent'] as const;
export const AUDIT_RESULTS = ['success', 'failed', 'blocked', 'warning'] as const;

export const AuditLogSchema = z.object({
    id: z.string().uuid(),
    createdAt: z
        .string()
        .datetime()
        .transform((value) => new Date(value)),
    actorType: z.enum(AUDIT_ACTOR_TYPES),
    actorId: z.string().uuid().nullable(),
    actorName: z.string().nullable(),
    action: z.string(),
    resourceType: z.string().nullable(),
    resourceId: z.string().uuid().nullable(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
    result: z.enum(AUDIT_RESULTS),
    message: z.string().nullable(),
    metadata: z.unknown().nullable(),
});

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];
export type AuditResult = (typeof AUDIT_RESULTS)[number];
