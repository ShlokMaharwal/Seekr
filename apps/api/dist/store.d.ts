import { type StoredDocument } from '@seekr/core';
export declare class DocumentStore {
    private client;
    private collection;
    connect(uri: string): Promise<void>;
    close(): Promise<void>;
    private get col();
    findById(id: string): Promise<StoredDocument | null>;
    count(): Promise<number>;
    stream(): AsyncGenerator<StoredDocument>;
}
//# sourceMappingURL=store.d.ts.map