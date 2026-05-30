/**
 * ============================================================================
 * PULSE API CONTRACT SCHEMAS
 * ============================================================================
 * Storing JSON Schemas in a dedicated folder keeps your use-case files clean
 * and allows schemas to be reused across different scenarios and validation tiers.
 * ============================================================================
 */

export const sampleUserSchema = {
    type: "object",
    required: ["id", "name", "source"],
    properties: {
        id: { type: "number" },
        name: { type: "string" },
        source: { type: "string" }
    }
};
