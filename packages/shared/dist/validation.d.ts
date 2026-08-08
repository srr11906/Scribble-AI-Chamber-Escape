import { z } from 'zod';
export declare const CreateChamberSchema: z.ZodObject<{
    codename: z.ZodString;
}, z.core.$strip>;
export declare const JoinChamberSchema: z.ZodObject<{
    codename: z.ZodString;
    chamberId: z.ZodString;
}, z.core.$strip>;
export declare const ConfigSchema: z.ZodObject<{
    maxPlayers: z.ZodNumber;
    drawTime: z.ZodNumber;
    cycles: z.ZodNumber;
    wordPack: z.ZodString;
    customWords: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const SelectWordSchema: z.ZodString;
export declare const SendMessageSchema: z.ZodString;
export declare const PointSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
}, z.core.$strip>;
export declare const StrokeSchema: z.ZodObject<{
    points: z.ZodArray<z.ZodNumber>;
    color: z.ZodString;
    size: z.ZodNumber;
    isEraser: z.ZodBoolean;
}, z.core.$strip>;
