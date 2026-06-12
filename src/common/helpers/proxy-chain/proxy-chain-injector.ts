/**
 * 链式代理注入器 (Proxy Chain Injector)
 *
 * 根据每个节点的 proxyChainConfig 配置，将上游代理注入到 Xray 配置中。
 * 利用 Xray 的 dialerProxy 机制，使该节点的出站流量先经过上游代理再到达目标。
 *
 * 流量路径: 用户 → 本节点 (inbound) → 上游代理 → 目标网站
 */

export interface ProxyChainConfig {
    /** 是否启用代理链 */
    enabled: boolean;

    /** 上游代理协议 */
    protocol: 'socks5' | 'http' | 'vless' | 'vmess' | 'trojan' | 'shadowsocks';

    /** 上游代理地址 */
    address: string;

    /** 上游代理端口 */
    port: number;

    // ---------- SOCKS5 / HTTP 认证 ----------
    username?: string;
    password?: string;

    // ---------- Shadowsocks ----------
    /** SS 加密方式，如 "aes-128-gcm", "chacha20-poly1305", "aes-256-gcm" 等 */
    method?: string;

    // ---------- VLESS / VMess / Trojan ----------
    uuid?: string; // VLESS / VMess 的 UUID
    flow?: string; // VLESS flow，如 "xtls-rprx-vision"
    alterId?: number; // VMess alterId，默认 0
    security?: string; // VMess 加密方式 "auto" | "none" | "aes-128-gcm" 等

    // ---------- 传输层 ----------
    network?: 'tcp' | 'ws' | 'grpc' | 'xhttp' | 'h2';
    tlsSecurity?: 'none' | 'tls' | 'reality';
    sni?: string;
    fingerprint?: string;
    realityPublicKey?: string;
    realityShortId?: string;
    realitySpiderX?: string;
    allowInsecure?: boolean;

    // ---------- WebSocket ----------
    wsPath?: string;
    wsHost?: string;

    // ---------- gRPC ----------
    grpcServiceName?: string;
}

export const PROXY_CHAIN_TAG = 'PROXY_CHAIN_UPSTREAM';

function buildStreamSettings(cfg: ProxyChainConfig): Record<string, unknown> | undefined {
    if (!cfg.network || cfg.network === 'tcp') {
        if (!cfg.tlsSecurity || cfg.tlsSecurity === 'none') {
            return undefined;
        }
    }

    const stream: Record<string, unknown> = {};

    if (cfg.network) {
        stream['network'] = cfg.network;
    }

    if (cfg.tlsSecurity && cfg.tlsSecurity !== 'none') {
        stream['security'] = cfg.tlsSecurity;

        if (cfg.tlsSecurity === 'tls') {
            const tlsSettings: Record<string, unknown> = {};
            if (cfg.sni) tlsSettings['serverName'] = cfg.sni;
            if (cfg.fingerprint) tlsSettings['fingerprint'] = cfg.fingerprint;
            if (cfg.allowInsecure) tlsSettings['allowInsecure'] = true;
            stream['tlsSettings'] = tlsSettings;
        }

        if (cfg.tlsSecurity === 'reality') {
            const realitySettings: Record<string, unknown> = {};
            if (cfg.sni) realitySettings['serverName'] = cfg.sni;
            if (cfg.fingerprint) realitySettings['fingerprint'] = cfg.fingerprint;
            if (cfg.realityPublicKey) realitySettings['publicKey'] = cfg.realityPublicKey;
            if (cfg.realityShortId) realitySettings['shortId'] = cfg.realityShortId;
            if (cfg.realitySpiderX) realitySettings['spiderX'] = cfg.realitySpiderX;
            stream['realitySettings'] = realitySettings;
        }
    }

    if (cfg.network === 'ws') {
        stream['wsSettings'] = {
            path: cfg.wsPath ?? '/',
            headers: cfg.wsHost ? { Host: cfg.wsHost } : {},
        };
    } else if (cfg.network === 'grpc') {
        stream['grpcSettings'] = {
            serviceName: cfg.grpcServiceName ?? '',
        };
    }

    return stream;
}

export function buildProxyOutbound(
    cfg: ProxyChainConfig,
    tag = PROXY_CHAIN_TAG,
): Record<string, unknown> {
    const stream = buildStreamSettings(cfg);

    switch (cfg.protocol) {
        case 'socks5': {
            const users =
                cfg.username && cfg.password ? [{ user: cfg.username, pass: cfg.password }] : [];
            return {
                tag,
                protocol: 'socks',
                settings: {
                    servers: [
                        {
                            address: cfg.address,
                            port: cfg.port,
                            users,
                        },
                    ],
                },
            };
        }

        case 'http': {
            const users =
                cfg.username && cfg.password ? [{ user: cfg.username, pass: cfg.password }] : [];
            return {
                tag,
                protocol: 'http',
                settings: {
                    servers: [
                        {
                            address: cfg.address,
                            port: cfg.port,
                            users,
                        },
                    ],
                },
            };
        }

        case 'vless': {
            const outbound: Record<string, unknown> = {
                tag,
                protocol: 'vless',
                settings: {
                    vnext: [
                        {
                            address: cfg.address,
                            port: cfg.port,
                            users: [
                                {
                                    id: cfg.uuid ?? '',
                                    flow: cfg.flow ?? '',
                                    encryption: 'none',
                                },
                            ],
                        },
                    ],
                },
            };
            if (stream) outbound['streamSettings'] = stream;
            return outbound;
        }

        case 'vmess': {
            const outbound: Record<string, unknown> = {
                tag,
                protocol: 'vmess',
                settings: {
                    vnext: [
                        {
                            address: cfg.address,
                            port: cfg.port,
                            users: [
                                {
                                    id: cfg.uuid ?? '',
                                    alterId: cfg.alterId ?? 0,
                                    security: cfg.security ?? 'auto',
                                },
                            ],
                        },
                    ],
                },
            };
            if (stream) outbound['streamSettings'] = stream;
            return outbound;
        }

        case 'trojan': {
            const outbound: Record<string, unknown> = {
                tag,
                protocol: 'trojan',
                settings: {
                    servers: [
                        {
                            address: cfg.address,
                            port: cfg.port,
                            password: cfg.password ?? '',
                        },
                    ],
                },
            };
            if (stream) outbound['streamSettings'] = stream;
            return outbound;
        }

        case 'shadowsocks': {
            const outbound: Record<string, unknown> = {
                tag,
                protocol: 'shadowsocks',
                settings: {
                    servers: [
                        {
                            address: cfg.address,
                            port: cfg.port,
                            method: cfg.method ?? 'aes-128-gcm',
                            password: cfg.password ?? '',
                            uot: false,
                        },
                    ],
                },
            };
            // SS 也支持传输层封装（如 obfs）
            if (cfg.network && cfg.network !== 'tcp') {
                const stream = buildStreamSettings(cfg);
                if (stream) outbound['streamSettings'] = stream;
            }
            return outbound;
        }

        default:
            throw new Error(`Unsupported proxy chain protocol: ${cfg.protocol}`);
    }
}

/**
 * 将代理链配置注入到 Xray 配置中。
 *
 * 实现方式:
 * 1. 在 outbounds 末尾添加上游代理出站 (PROXY_CHAIN_UPSTREAM)
 * 2. 为所有 freedom 出站添加 streamSettings.sockopt.dialerProxy 指向 PROXY_CHAIN_UPSTREAM
 *
 * @param config - 原始 Xray JSON 配置对象
 * @param rawProxyChainConfig - 从数据库读取的 proxyChainConfig（JSON object）
 * @returns 注入代理链后的 Xray 配置对象
 */
export function injectProxyChain(config: any, rawProxyChainConfig: object | null | undefined): any {
    try {
        if (!config) return config;
        if (!rawProxyChainConfig) return config;

        const cfg = rawProxyChainConfig as ProxyChainConfig;

        if (!cfg.enabled) return config;
        if (!cfg.address || !cfg.port || !cfg.protocol) return config;

        // 1. 构建上游代理出站
        const upstreamOutbound = buildProxyOutbound(cfg);

        // 2. 确保 outbounds 数组存在
        if (!config.outbounds) {
            config.outbounds = [];
        }

        // 3. 检查是否已存在 PROXY_CHAIN_UPSTREAM，避免重复注入
        const existing = config.outbounds.findIndex((o: any) => o.tag === PROXY_CHAIN_TAG);
        if (existing !== -1) {
            config.outbounds[existing] = upstreamOutbound;
        } else {
            config.outbounds.push(upstreamOutbound);
        }

        // 4. 为所有 freedom 出站添加 dialerProxy
        for (const outbound of config.outbounds) {
            if (
                outbound.protocol === 'freedom' &&
                outbound.tag !== PROXY_CHAIN_TAG &&
                outbound.tag !== 'EGRESS_DIRECT'
            ) {
                if (!outbound.streamSettings) {
                    outbound.streamSettings = {};
                }
                if (!outbound.streamSettings.sockopt) {
                    outbound.streamSettings.sockopt = {};
                }
                outbound.streamSettings.sockopt.dialerProxy = PROXY_CHAIN_TAG;
            }
        }

        return config;
    } catch {
        return config;
    }
}
