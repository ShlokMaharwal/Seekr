/**
 * Document Store – MongoDB persistence for crawled documents.
 *
 * Collection: "documents"
 *   { _id: string (=id), url, title, text, crawledAt, wordCount, contentHash }
 *
 * Indexes:
 *   - url (unique)
 *   - contentHash (for duplicate detection)
 *   - crawledAt (for sorting)
 */
import { type StoredDocument } from '@seekr/core';
export declare class DocumentStore {
    private client;
    private collection;
    connect(uri: string): Promise<void>;
    close(): Promise<void>;
    private get col();
    /**
     * Upsert a document by URL.
     * Returns true if the document was new, false if it was an update.
     */
    upsert(doc: StoredDocument): Promise<boolean>;
    findById(id: string): Promise<StoredDocument | null>;
    findByUrl(url: string): Promise<StoredDocument | null>;
    existsByContentHash(hash: string): Promise<boolean>;
    count(): Promise<number>;
    /**
     * Stream all document IDs, URLs, and text for index rebuilding.
     */
    stream(): AsyncGenerator<StoredDocument>;
}
//# sourceMappingURL=store.d.ts.map