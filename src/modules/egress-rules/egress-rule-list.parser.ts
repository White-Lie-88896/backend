export interface ParsedRuleList {
    duplicates: number;
    patterns: string[];
    unsupported: number;
}

const RULE_TYPE_MAP: Record<string, (value: string) => string | null> = {
    DOMAIN: (value) => `full:${value}`,
    'DOMAIN-SUFFIX': (value) => `domain:${value}`,
    'DOMAIN-KEYWORD': (value) => `keyword:${value}`,
    'IP-CIDR': (value) => value,
    'IP-CIDR6': (value) => value,
    GEOIP: (value) => `geoip:${value}`,
    GEOSITE: (value) => `geosite:${value}`,
    'DST-PORT': (value) => `port:${value}`,
    NETWORK: (value) => `protocol:${value.toLowerCase()}`,
};

function cleanLine(rawLine: string): string {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line === 'payload:') return '';
    line = line.replace(/^-\s*/, '').trim();
    if (
        (line.startsWith('"') && line.endsWith('"')) ||
        (line.startsWith("'") && line.endsWith("'"))
    ) {
        line = line.slice(1, -1).trim();
    }
    const commentIndex = line.indexOf(' #');
    return (commentIndex >= 0 ? line.slice(0, commentIndex) : line).trim();
}

export function parseEgressRuleList(content: string, limit = 2_000): ParsedRuleList {
    const patterns: string[] = [];
    const seen = new Set<string>();
    let duplicates = 0;
    let unsupported = 0;

    for (const rawLine of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const line = cleanLine(rawLine);
        if (!line) continue;

        const parts = line.split(',').map((part) => part.trim());
        let pattern: string | null = null;
        if (parts.length >= 2) {
            const mapper = RULE_TYPE_MAP[parts[0].toUpperCase()];
            pattern = mapper ? mapper(parts[1]) : null;
        } else if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(line)) {
            pattern = `domain:${line}`;
        } else if (/^[0-9a-f:.]+\/\d+$/i.test(line)) {
            pattern = line;
        }

        if (!pattern) {
            unsupported++;
            continue;
        }

        const normalized = pattern.toLowerCase();
        if (seen.has(normalized)) {
            duplicates++;
            continue;
        }
        seen.add(normalized);
        patterns.push(pattern);
        if (patterns.length >= limit) break;
    }

    return { duplicates, patterns, unsupported };
}
