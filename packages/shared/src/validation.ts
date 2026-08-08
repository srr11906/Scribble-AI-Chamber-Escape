import { z } from 'zod';

export const CreateChamberSchema = z.object({
  codename: z.string().min(1, 'Nickname is required').max(16, 'Nickname must be 16 characters or less').trim(),
});

export const JoinChamberSchema = z.object({
  codename: z.string().min(1, 'Nickname is required').max(16, 'Nickname must be 16 characters or less').trim(),
  chamberId: z.string().length(6, 'Chamber Code must be exactly 6 characters').toUpperCase().trim(),
});

export const ConfigSchema = z.object({
  maxPlayers: z.number().int().min(3).max(12),
  drawTime: z.number().int().min(30).max(120),
  cycles: z.number().int().min(1).max(10),
  wordPack: z.string().min(1),
  customWords: z.array(z.string().trim()).default([]),
});

export const SelectWordSchema = z.string().min(1).max(30).trim();

export const SendMessageSchema = z.string().min(1, 'Message cannot be empty').max(150, 'Message is too long').trim();

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const StrokeSchema = z.object({
  points: z.array(z.number()),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
  size: z.number().positive(),
  isEraser: z.boolean(),
});
