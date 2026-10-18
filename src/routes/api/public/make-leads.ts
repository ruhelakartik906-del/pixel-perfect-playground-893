import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/make-leads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMakeIntake } = await import('@/lib/make-intake.server');
        return handleMakeIntake(request);
      },
      GET: () => Response.json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST with application/json' } }, { status: 405, headers: { Allow: 'POST' } }),
    },
  },
});