function onOpen() {
  SpreadsheetApp.getUi().createMenu('Project Monitoring')
    .addItem('Initialize / refresh foundation', 'setupFoundation')
    .addToUi();
}
// No onEdit or time-driven workflow triggers in Sprint 1.
