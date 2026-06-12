import { createHash } from 'node:crypto';
import YAML from 'yaml';

import { ProxyOutboundConfig, ProxyOutboundConfigSchema } from '@libs/contracts/models';

export interface ParsedSubscriptionNode {
    sourceKey: string;
    name: string;
    config: ProxyOutboundConfig;
}

const decodeBase64 = (value: string): string => {
    try {
        const normalized = value.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8');
    } catch {
        return '';
    }
};

const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const port = (value: unknown, fallback = 443): number => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
};

const network = (value: unknown): ProxyOutboundConfig['network'] =>
    ['grpc', 'h2', 'tcp', 'ws', 'xhttp'].includes(String(value))
        ? (String(value) as ProxyOutboundConfig['network'])
        : 'tcp';

const tls = (value: unknown): ProxyOutboundConfig['tlsSecurity'] =>
    ['reality', 'tls'].includes(String(value))
        ? (String(value) as ProxyOutboundConfig['tlsSecurity'])
        : 'none';

export function parseProxyUri(raw: string): { name: string; config: ProxyOutboundConfig } | null {
    const link = raw.trim();
    if (!link) return null;
    try {
        if (link.toLowerCase().startsWith('vmess://')) {
            const data = JSON.parse(decodeBase64(link.slice(8))) as Record<string, unknown>;
            return {
                name: String(data.ps || `${data.add}:${data.port}`),
                config: ProxyOutboundConfigSchema.parse({
                    protocol: 'vmess',
                    address: String(data.add || ''),
                    port: port(data.port),
                    uuid: String(data.id || ''),
                    alterId: Number(data.aid) || 0,
                    security: String(data.scy || 'auto'),
                    network: network(data.net),
                    tlsSecurity: tls(data.tls),
                    sni: data.sni ? String(data.sni) : undefined,
                    wsHost: data.host ? String(data.host) : undefined,
                    wsPath: data.path ? String(data.path) : undefined,
                }),
            };
        }

        if (link.toLowerCase().startsWith('ss://')) {
            const [body, fragment = ''] = link.slice(5).split('#', 2);
            const payload = body.split('?', 1)[0];
            const expanded = payload.includes('@') ? payload : decodeBase64(payload);
            const separator = expanded.lastIndexOf('@');
            if (separator < 0) return null;
            let credentials = expanded.slice(0, separator);
            if (!credentials.includes(':')) credentials = decodeBase64(credentials);
            const split = credentials.indexOf(':');
            const endpoint = new URL(`ss://${expanded.slice(separator + 1)}`);
            return {
                name: safeDecode(fragment) || `${endpoint.hostname}:${endpoint.port}`,
                config: ProxyOutboundConfigSchema.parse({
                    protocol: 'shadowsocks',
                    address: endpoint.hostname,
                    port: port(endpoint.port, 8388),
                    method: safeDecode(credentials.slice(0, split)),
                    password: safeDecode(credentials.slice(split + 1)),
                }),
            };
        }

        const url = new URL(link);
        const scheme = url.protocol.slice(0, -1).toLowerCase();
        const name = safeDecode(url.hash.slice(1)) || `${url.hostname}:${url.port}`;
        if (['http', 'https', 'socks', 'socks5'].includes(scheme)) {
            return {
                name,
                config: ProxyOutboundConfigSchema.parse({
                    protocol: scheme.startsWith('socks') ? 'socks5' : 'http',
                    address: url.hostname,
                    port: port(url.port, scheme.startsWith('socks') ? 1080 : 80),
                    username: safeDecode(url.username) || undefined,
                    password: safeDecode(url.password) || undefined,
                }),
            };
        }
        if (!['trojan', 'vless'].includes(scheme)) return null;
        const common = {
            address: url.hostname,
            port: port(url.port),
            network: network(url.searchParams.get('type')),
            tlsSecurity: tls(url.searchParams.get('security')),
            sni: url.searchParams.get('sni') || undefined,
            fingerprint: url.searchParams.get('fp') || undefined,
            realityPublicKey: url.searchParams.get('pbk') || undefined,
            realityShortId: url.searchParams.get('sid') || undefined,
            realitySpiderX: url.searchParams.get('spx') || undefined,
            wsHost: url.searchParams.get('host') || undefined,
            wsPath: url.searchParams.get('path') || undefined,
            grpcServiceName: url.searchParams.get('serviceName') || undefined,
        };
        return {
            name,
            config: ProxyOutboundConfigSchema.parse(
                scheme === 'vless'
                    ? {
                          ...common,
                          protocol: 'vless',
                          uuid: safeDecode(url.username),
                          flow: url.searchParams.get('flow') || undefined,
                      }
                    : { ...common, protocol: 'trojan', password: safeDecode(url.username) },
            ),
        };
    } catch {
        return null;
    }
}

function parseClashNode(item: Record<string, unknown>) {
    const type = String(item.type || '').toLowerCase();
    const protocol =
        type === 'ss'
            ? 'shadowsocks'
            : type === 'socks5'
              ? 'socks5'
              : ['http', 'trojan', 'vless', 'vmess'].includes(type)
                ? type
                : null;
    if (!protocol) return null;
    const parsed = ProxyOutboundConfigSchema.safeParse({
        protocol,
        address: item.server,
        port: port(item.port),
        username: item.username,
        password: item.password,
        method: item.cipher,
        uuid: item.uuid,
        alterId: Number(item.alterId) || 0,
        security: item.cipher || 'auto',
        network: network(item.network),
        tlsSecurity: item['reality-opts'] ? 'reality' : item.tls ? 'tls' : 'none',
        sni: item.servername,
        fingerprint: item['client-fingerprint'],
        realityPublicKey: (item['reality-opts'] as Record<string, unknown> | undefined)?.[
            'public-key'
        ],
        realityShortId: (item['reality-opts'] as Record<string, unknown> | undefined)?.['short-id'],
        wsPath: (item['ws-opts'] as Record<string, unknown> | undefined)?.path,
        wsHost: (
            (item['ws-opts'] as Record<string, unknown> | undefined)?.headers as
                | Record<string, unknown>
                | undefined
        )?.Host,
        grpcServiceName: (item['grpc-opts'] as Record<string, unknown> | undefined)?.[
            'grpc-service-name'
        ],
    });
    if (!parsed.success) return null;
    return {
        name: String(item.name || `${item.server}:${item.port}`),
        config: parsed.data,
    };
}

export function parseSubscriptionContent(content: string): ParsedSubscriptionNode[] {
    let candidates: Array<{ name: string; config: ProxyOutboundConfig }> = [];
    const trimmed = content.trim();

    try {
        const document = YAML.parse(trimmed) as Record<string, unknown>;
        const proxies = Array.isArray(document?.proxies) ? document.proxies : [];
        candidates = proxies
            .map((item) => parseClashNode(item as Record<string, unknown>))
            .filter((item): item is { name: string; config: ProxyOutboundConfig } => item !== null);
    } catch {
        // Fall through to URI subscription parsing.
    }

    if (candidates.length === 0) {
        const decoded = trimmed.includes('://') ? trimmed : decodeBase64(trimmed);
        candidates = decoded
            .split(/\r?\n/)
            .map(parseProxyUri)
            .filter((item): item is { name: string; config: ProxyOutboundConfig } => item !== null);
    }

    const deduplicated = new Map<string, ParsedSubscriptionNode>();
    for (const candidate of candidates) {
        const sourceKey = createHash('sha256')
            .update(JSON.stringify(candidate.config))
            .digest('hex')
            .slice(0, 32);
        deduplicated.set(sourceKey, { ...candidate, sourceKey });
    }
    return Array.from(deduplicated.values());
}
