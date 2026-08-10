"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceSpeakingSchema = exports.VoiceStateSchema = exports.VoiceIceCandidateSchema = exports.VoiceAnswerSchema = exports.VoiceOfferSchema = exports.StrokeSchema = exports.PointSchema = exports.SendMessageSchema = exports.SelectWordSchema = exports.ConfigSchema = exports.JoinChamberSchema = exports.CreateChamberSchema = void 0;
const zod_1 = require("zod");
exports.CreateChamberSchema = zod_1.z.object({
    codename: zod_1.z.string().min(1, 'Nickname is required').max(16, 'Nickname must be 16 characters or less').trim(),
});
exports.JoinChamberSchema = zod_1.z.object({
    codename: zod_1.z.string().min(1, 'Nickname is required').max(16, 'Nickname must be 16 characters or less').trim(),
    chamberId: zod_1.z.string().length(6, 'Chamber Code must be exactly 6 characters').toUpperCase().trim(),
});
exports.ConfigSchema = zod_1.z.object({
    maxPlayers: zod_1.z.number().int().min(3).max(12),
    drawTime: zod_1.z.number().int().min(30).max(120),
    cycles: zod_1.z.number().int().min(1).max(10),
    wordPack: zod_1.z.string().min(1),
    customWords: zod_1.z.array(zod_1.z.string().trim()).default([]),
});
exports.SelectWordSchema = zod_1.z.string().min(1).max(30).trim();
exports.SendMessageSchema = zod_1.z.string().min(1, 'Message cannot be empty').max(150, 'Message is too long').trim();
exports.PointSchema = zod_1.z.object({
    x: zod_1.z.number(),
    y: zod_1.z.number(),
});
exports.StrokeSchema = zod_1.z.object({
    points: zod_1.z.array(zod_1.z.number()),
    color: zod_1.z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
    size: zod_1.z.number().positive(),
    isEraser: zod_1.z.boolean(),
});
exports.VoiceOfferSchema = zod_1.z.object({
    targetId: zod_1.z.string().min(1, 'Target ID is required'),
    sdp: zod_1.z.any(),
});
exports.VoiceAnswerSchema = zod_1.z.object({
    targetId: zod_1.z.string().min(1, 'Target ID is required'),
    sdp: zod_1.z.any(),
});
exports.VoiceIceCandidateSchema = zod_1.z.object({
    targetId: zod_1.z.string().min(1, 'Target ID is required'),
    candidate: zod_1.z.any(),
});
exports.VoiceStateSchema = zod_1.z.object({
    micEnabled: zod_1.z.boolean(),
    speakerEnabled: zod_1.z.boolean(),
});
exports.VoiceSpeakingSchema = zod_1.z.object({
    speaking: zod_1.z.boolean(),
});
//# sourceMappingURL=validation.js.map