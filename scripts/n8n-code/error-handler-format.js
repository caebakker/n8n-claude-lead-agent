const item = $input.first().json;
const execution = item.execution || {};
const error = execution.error || item.error || {};
const message = error.message || 'Unknown workflow error';

pushError({
  kind: 'error_workflow',
  workflow: item.workflow && item.workflow.name ? item.workflow.name : 'unknown',
  executionId: execution.id || null,
  lastNode: execution.lastNodeExecuted || null,
  message: String(message).slice(0, 500),
});

return [
  {
    json: {
      logged: true,
      workflow: item.workflow || null,
      executionId: execution.id || null,
      lastNode: execution.lastNodeExecuted || null,
      message: String(message).slice(0, 500),
    },
  },
];
