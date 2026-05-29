export function generateCPF(formatted: boolean = true): string {
    const random = (n: number) => Math.round(Math.random() * n);
    const mod = (dividend: number, divisor: number) => Math.round(dividend - (Math.floor(dividend / divisor) * divisor));

    const n1 = random(9); const n2 = random(9); const n3 = random(9);
    const n4 = random(9); const n5 = random(9); const n6 = random(9);
    const n7 = random(9); const n8 = random(9); const n9 = random(9);

    let d1 = n9 * 2 + n8 * 3 + n7 * 4 + n6 * 5 + n5 * 6 + n4 * 7 + n3 * 8 + n2 * 9 + n1 * 10;
    d1 = 11 - (mod(d1, 11)); if (d1 >= 10) d1 = 0;

    let d2 = d1 * 2 + n9 * 3 + n8 * 4 + n7 * 5 + n6 * 6 + n5 * 7 + n4 * 8 + n3 * 9 + n2 * 10 + n1 * 11;
    d2 = 11 - (mod(d2, 11)); if (d2 >= 10) d2 = 0;

    if (formatted) {
        return `${n1}${n2}${n3}.${n4}${n5}${n6}.${n7}${n8}${n9}-${d1}${d2}`;
    }
    return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

export function generateName(): string {
    const firstNames = ["Augusto", "Beatriz", "Carlos", "Daniela", "Eduardo", "Fernanda", "Gabriel", "Julia"];
    const lastNames = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Pereira", "Gomes"];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const secondLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName} ${secondLastName}`;
}

export function generateRandomString(length: number = 10, type: "alphanumeric" | "numeric" | "alpha" = "alphanumeric"): string {
    let characters = type === "numeric" ? "0123456789" : type === "alpha" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
