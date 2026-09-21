import { Textbook } from './types';
export declare function initDB(): Promise<void>;
export declare function saveTextbook(textbook: Textbook): Promise<void>;
export declare function getTextbook(id: string): Promise<Textbook | null>;
export declare function listTextbooks(): Promise<Textbook[]>;
export declare function deleteTextbook(id: string): Promise<void>;
export declare function requestPersistentStorage(): Promise<boolean>;
//# sourceMappingURL=db.d.ts.map