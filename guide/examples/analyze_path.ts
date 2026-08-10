import { readFileSync } from 'node:fs';

interface Step {
    x: number;
    y: number;
    t: number;
}

interface Segment {
    distance: number;
    durationMs: number;
    speed: number;
}

function fail(message: string): never {
    throw new Error(message);
}

function parsePath(filename: string): Step[] {
    const value: unknown = JSON.parse(readFileSync(filename, 'utf8'));
    if (!Array.isArray(value) || value.length < 2) {
        return fail('path는 point가 두 개 이상인 JSON array여야 합니다.');
    }

    return value.map((item: unknown, index: number) => {
        if (typeof item !== 'object' || item === null) {
            return fail(`point ${index}: object가 아닙니다.`);
        }

        const candidate = item as Record<string, unknown>;
        const { x, y, t } = candidate;
        if (![x, y, t].every((field) => typeof field === 'number' && Number.isFinite(field))) {
            return fail(`point ${index}: x, y, t는 finite number여야 합니다.`);
        }
        return { x: x as number, y: y as number, t: t as number };
    });
}

function distance(from: Step, to: Step): number {
    return Math.hypot(to.x - from.x, to.y - from.y);
}

function segmentsFor(path: Step[]): Segment[] {
    return path.slice(1).map((point, index) => {
        const previous = path[index];
        const durationMs = point.t - previous.t;
        if (durationMs <= 0) {
            return fail(`segment ${index}: timestamp가 증가해야 합니다.`);
        }
        const segmentDistance = distance(previous, point);
        return {
            distance: segmentDistance,
            durationMs,
            speed: segmentDistance / (durationMs / 1000),
        };
    });
}

function round(value: number): number {
    return Number(value.toFixed(3));
}

function analyze(path: Step[]) {
    if (path[0].t !== 0) {
        fail('첫 point의 t는 0이어야 합니다.');
    }

    const segments = segmentsFor(path);
    const pathLength = segments.reduce((sum, segment) => sum + segment.distance, 0);
    const straightDistance = distance(path[0], path[path.length - 1]);
    const durationMs = path[path.length - 1].t;
    const speeds = segments.map((segment) => segment.speed);
    const jumps = segments.map((segment) => segment.distance);
    const xs = path.map((point) => point.x);
    const ys = path.map((point) => point.y);

    return {
        points: path.length,
        segments: segments.length,
        durationMs: round(durationMs),
        straightDistancePx: round(straightDistance),
        pathLengthPx: round(pathLength),
        efficiency: pathLength === 0 ? 1 : round(straightDistance / pathLength),
        meanSpeedPxPerSec: round(pathLength / (durationMs / 1000)),
        maxSpeedPxPerSec: round(Math.max(...speeds)),
        maxJumpPx: round(Math.max(...jumps)),
        finalJumpPx: round(jumps[jumps.length - 1]),
        bounds: {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        },
    };
}

function main(): void {
    const filename = process.argv[2];
    if (!filename) {
        fail('사용법: node --experimental-strip-types analyze_path.ts <path.json>');
    }
    console.log(JSON.stringify(analyze(parsePath(filename)), null, 2));
}

try {
    main();
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`오류: ${message}`);
    process.exitCode = 1;
}
