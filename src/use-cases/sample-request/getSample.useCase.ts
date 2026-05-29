import { get, post } from "@pulse/http";

export interface SampleParams { baseUrl: string; token: string; }
export interface CreateSampleParams extends SampleParams { userPayload: any; label?: string; }

export function getSample({ baseUrl, token }: SampleParams) {
    const url = `${baseUrl}/sample`;
    return get(url, { token }, 200, "getSample");
}

export function createSampleUser({ baseUrl, token, userPayload, label = "createSampleUser" }: CreateSampleParams) {
    const url = `${baseUrl}/users`;
    return post(url, userPayload, { token }, 201, label);
}
