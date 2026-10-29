function pushError(entry) {
  const store = $getWorkflowStaticData('global');
  if (!Array.isArray(store.errorLog)) store.errorLog = [];
  store.errorLog.push({ at: new Date().toISOString(), ...entry });
  if (store.errorLog.length > 50) store.errorLog.splice(0, store.errorLog.length - 50);
}
