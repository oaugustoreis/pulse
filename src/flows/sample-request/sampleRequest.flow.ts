import { ps } from "@pulse/core";
import { getSample, createSampleUser } from "@src/use-cases/sample-request/getSample.useCase";
import { generateCPF, generateName } from "@data/generators/dataGenerator";

export interface FlowParams { baseUrl: string; token: string; datasetUser?: any; }

export function sampleRequestFlow({ baseUrl, token, datasetUser }: FlowParams): void {
    ps.group("Sample Request Full Flow", () => {
        getSample({ baseUrl, token });

        const dynamicUser = {
            name: generateName(),
            cpf: generateCPF(false),
            source: "generator",
            createdAt: new Date().toISOString()
        };

        createSampleUser({
            baseUrl,
            token,
            userPayload: dynamicUser,
            label: "POST_User_Dynamic"
        });

        if (datasetUser) {
            const { id, ...userWithoutId } = datasetUser;
            createSampleUser({
                baseUrl,
                token,
                userPayload: { ...userWithoutId, source: "dataset" },
                label: "POST_User_Dataset"
            });
        }

        ps.sleep(1);
    });
}
