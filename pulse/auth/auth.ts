import { post } from "../http/http.js";

export function getAuth(baseUrl: string, email: string, password: string) {
    const payload = { email, password };
    const res = post(baseUrl, payload, {}, 200, "GetAuthToken");

    const token = res.json("accessToken");
    if (!token) {
        throw new Error(`Auth failed | status=${res.status} | body=${res.body}`);
    }

    return {
        token,
        expiresIn: res.json("expiresIn"),
    };
}
