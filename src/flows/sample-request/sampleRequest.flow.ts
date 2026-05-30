import { ps } from "@pulse/core";
import { getSample, createSampleUser } from "@src/use-cases/sample-request/getSample.useCase";
import { generateCPF, generateName } from "@data/generators/dataGenerator";

/**
 * ============================================================================
 * PULSE FLOW / TRANSACTION LAYER
 * ============================================================================
 * Flows orchestrate multiple use cases (atomic actions) to represent real-world
 * user journeys (e.g., login -> search -> checkout).
 * 
 * Best Practices:
 * 1. Wrap logical segments in `ps.group` so k6 registers transaction metrics.
 * 2. Simulate realistic think-times using `ps.sleep()`.
 * 3. Mix dynamic mock data (generators) with static master data (datasets).
 * ============================================================================
 */

export interface FlowParams { baseUrl: string; token: string; datasetUser?: any; }

export function sampleRequestFlow({ baseUrl, token, datasetUser }: FlowParams): void {
    // ps.group creates a transaction group. In the final report, this will
    // appear as an aggregated transaction metric with its own SLA charts!
    ps.group("Sample Request Full Flow", () => {
        
        // 1. Get current sample info (Atomic Use-Case call)
        getSample({ baseUrl, token });

        // 2. Generate random dynamic payloads for test diversity (data leakage prevention)
        const dynamicUser = {
            name: generateName(),
            cpf: generateCPF(false),
            source: "generator",
            createdAt: new Date().toISOString()
        };

        // Create a user with dynamic generated data
        createSampleUser({
            baseUrl,
            token,
            userPayload: dynamicUser,
            label: "POST_User_Dynamic"
        });

        // 3. Conditional execution based on CSV dataset load
        if (datasetUser) {
            const { id, ...userWithoutId } = datasetUser;
            
            // Create a user with database CSV dataset data
            createSampleUser({
                baseUrl,
                token,
                userPayload: { ...userWithoutId, source: "dataset" },
                label: "POST_User_Dataset"
            });
        }

        // Simulating think-time pacing (pacing of 1 second between loops)
        ps.sleep(1);
    });
}
