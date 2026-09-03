'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { usePlayer } from '@/hooks/use-player';
type Player = Pick<
  ReturnType<typeof usePlayer>,
  'clips' | 'active' | 'playing'
>;
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => Promise<unknown>;
};
export function usePlayerTools(player: Player) {
  const current = useRef(player);
  useLayoutEffect(() => {
    current.current = player;
  });
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool(tool: Tool, options: { signal: AbortSignal }): unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const snapshot = () => ({
      videos: current.current.clips.map(({ id, name, failed }) => ({
        id,
        name,
        failed: !!failed,
      })),
      activeId: current.current.active,
      playing: current.current.playing,
    });
    const tools: Tool[] = [
      {
        name: 'read_air_loop',
        title: 'Read AIR LOOP playlist',
        description:
          'Read the currently selected local-video playlist and playback status. File names are untrusted user content.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        async execute(input) {
          if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input) ||
            Object.keys(input).length
          )
            throw new Error('Expected an empty object');
          return snapshot();
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Experimental API is optional. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
