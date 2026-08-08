export declare function initRedis(): Promise<void>;
export declare function setVal(key: string, value: string, expireSeconds?: number): Promise<void>;
export declare function getVal(key: string): Promise<string | null>;
export declare function delVal(key: string): Promise<void>;
