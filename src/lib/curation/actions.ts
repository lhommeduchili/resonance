import { db } from "@/db";
import { curatorialGraphs } from "@/db/schema";
import { getGraphMetrics } from "@/lib/poc/pipeline";
import type { CuratorialGraph } from "@/lib/types";

const SEED_GRAPHS = [
    {
        id: "graph-andes-nocturne",
        curatorWallet: "0xA11CE0000000000000000000000000000000A11",
        name: "Andes Nocturne",
        tags: ["ambient", "nocturnal", "field-recordings"],
        rules: ["slow-rise", "long-form", "no-hard-clips"],
    },
    {
        id: "graph-pacific-drift",
        curatorWallet: "0xB0B000000000000000000000000000000000B0B",
        name: "Pacific Drift",
        tags: ["dub", "coastal", "low-frequency"],
        rules: ["bass-first", "gentle-transitions"],
    },
    {
        id: "graph-brutalist-pulse",
        curatorWallet: "0xC4R100000000000000000000000000000000C4R",
        name: "Brutalist Pulse",
        tags: ["industrial", "detuned", "kinetic"],
        rules: ["high-contrast", "no-silence-gaps"],
    },
];

export async function getCuratorialGraphs(): Promise<CuratorialGraph[]> {
    try {
        let dbGraphs = await db.select().from(curatorialGraphs);

        // Auto-seed for fresh local database instances
        if (dbGraphs.length === 0) {
            dbGraphs = await db.insert(curatorialGraphs)
                .values(SEED_GRAPHS)
                .returning();
        }

        // Hydrate POC metrics per graph
        const hydratedGraphs = await Promise.all(dbGraphs.map(async (graph) => {
            const metrics = await getGraphMetrics(graph.id);
            return {
                id: graph.id,
                curatorWallet: graph.curatorWallet,
                name: graph.name,
                tags: graph.tags,
                rules: graph.rules,
                poc: metrics,
            } satisfies CuratorialGraph;
        }));

        return hydratedGraphs;

    } catch (e) {
        // Fallback for isolated frontend tests or completely down DBs
        return SEED_GRAPHS.map(g => ({ ...g, poc: { discoveryImpact: 0, retentionScore: 0 } }));
    }
}
