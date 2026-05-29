import { SharedArray } from "k6/data";

export function loadJson<T = any>(name: string, filePath: string): T[] {
    return new SharedArray(name, function () {
        return JSON.parse(open(filePath));
    });
}

export function loadCsv<T = any>(name: string, filePath: string, delimiter: string = ","): T[] {
    return new SharedArray(name, function () {
        const data = open(filePath).split("\n").filter(line => line.trim() !== "");
        const headers = data[0].split(delimiter).map(h => h.trim());
        
        return data.slice(1).map(line => {
            const values = line.split(delimiter);
            const obj: any = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : null;
            });
            return obj as T;
        });
    });
}
