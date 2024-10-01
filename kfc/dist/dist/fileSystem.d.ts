export interface FileSystem {
    readFile(filePath: string): string;
    writeFile(filePath: string, content: string): void;
    readdirSync(directory: string): string[];
}
export declare class NodeFileSystem implements FileSystem {
    readFile(filePath: string): string;
    writeFile(filePath: string, content: string): void;
    readdirSync(directory: string): string[];
}
//# sourceMappingURL=fileSystem.d.ts.map