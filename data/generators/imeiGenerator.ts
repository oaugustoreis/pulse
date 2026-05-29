export function generateIMEI(): string {
    let imei = "";
    for (let i = 0; i < 14; i++) {
        imei += Math.floor(Math.random() * 10);
    }
    let sum = 0;
    for (let i = 0; i < 14; i++) {
        let digit = parseInt(imei.charAt(i), 10);
        if (i % 2 !== 0) {
            digit *= 2;
            if (digit > 9) digit = digit - 9;
        }
        sum += digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return imei + checkDigit;
}

export function generateEAN13(): string {
    let ean = "789"; // Brazil prefix
    for (let i = 0; i < 9; i++) {
        ean += Math.floor(Math.random() * 10);
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        let digit = parseInt(ean.charAt(i), 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return ean + checkDigit;
}
