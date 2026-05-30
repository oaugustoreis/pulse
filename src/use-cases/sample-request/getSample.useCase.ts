import { get, post } from "@pulse/http";
import { ps } from "@pulse/core";
import { sampleUserSchema } from "@src/schemas/sample-request/sampleUser.schema";

export interface SampleParams { baseUrl: string; token: string; }
export interface CreateSampleParams extends SampleParams { userPayload: any; label?: string; }

export function getSample({ baseUrl, token }: SampleParams) {
    const url = `${baseUrl}/sample`;
    const res = get(url, { token }, 200, "getSample");

    // Fluent SLA & Header Assertions Example:
    ps.expect(res)
        .status(200)
        .bodyNotEmpty()
        .responseTimeLessThan(800) // SLA requirement: Response must be under 800ms
        .header("Content-Type", "application/json");

    return res;
}

export function createSampleUser({ baseUrl, token, userPayload, label = "createSampleUser" }: CreateSampleParams) {
    const url = `${baseUrl}/users`;
    const res = post(url, userPayload, { token }, 201, label);

    // Fluent Schema Contract & Property Assertions Example:
    ps.expect(res)
        .status(201)
        .bodyNotEmpty()
        .responseTimeLessThan(1500) // Write SLA requirement: Under 1500ms
        .hasProperty("id")
        .jsonSchema(sampleUserSchema);

    return res;
}
