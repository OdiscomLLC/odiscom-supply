import { app } from '@azure/functions'

app.http('health', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'health',
  handler: async (_request, context) => {
    context.log('Odiscom Supply Azure Functions health check')
    return {
      status: 200,
      jsonBody: {
        ok: true,
        service: 'odiscom-supply-functions',
        environment: process.env.ODISCOM_SUPPLY_ENVIRONMENT || 'unknown',
        timestamp: new Date().toISOString(),
      },
    }
  },
})
