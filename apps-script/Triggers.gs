function onOpen() {
  SpreadsheetApp.getUi().createMenu('Project Monitoring')
    .addItem('Initialize / refresh foundation', 'setupFoundation')
    .addItem('Set up SRO pilot', 'setupSroPilot')
    .addItem('Sync Planning now', 'planningSyncJob')
    .addItem('Refresh SRO health', 'recalculateSroPilot')
    .addItem('Refresh SRO edit access', 'refreshSroPilotAccess')
    .addItem('Enable Planning auto-sync', 'enablePlanningAutoSync')
    .addItem('Disable Planning auto-sync', 'disablePlanningAutoSync')
    .addToUi();
}
// SRO installable edit/sync triggers are explicitly enabled by an Admin; no other jobs.
