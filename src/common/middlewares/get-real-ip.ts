import { NextFunction, Request, Response } from 'express';
import { getClientIp } from '@kastov/request-ip';
import morgan from 'morgan';

import { REMNAWAVE_REAL_IP_HEADER } from '@libs/contracts/constants';

function normalizeIp(ip: string | undefined): string | undefined {
    return ip?.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isTrustedProxy(ip: string | undefined): boolean {
    const normalizedIp = normalizeIp(ip);
    if (!normalizedIp) {
        return false;
    }

    if (
        normalizedIp === '::1' ||
        normalizedIp.startsWith('fc') ||
        normalizedIp.startsWith('fd') ||
        /^fe[89ab]/i.test(normalizedIp)
    ) {
        return true;
    }

    const octets = normalizedIp.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
        return false;
    }

    return (
        octets[0] === 10 ||
        octets[0] === 127 ||
        (octets[0] === 169 && octets[1] === 254) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && octets[1] === 168)
    );
}

morgan.token('remote-addr', (req: { clientIp: string } & Request) => {
    return req.clientIp;
});

export const getRealIp = function (
    req: { clientIp: string } & Request,
    res: Response,
    next: NextFunction,
) {
    const socketIp = normalizeIp(req.socket.remoteAddress);
    const forwardedIp = isTrustedProxy(socketIp)
        ? getClientIp(req, [REMNAWAVE_REAL_IP_HEADER, 'x-real-ip', 'x-forwarded-for'])
        : undefined;

    req.clientIp = normalizeIp(forwardedIp) ?? socketIp ?? '0.0.0.0';

    next();
};
