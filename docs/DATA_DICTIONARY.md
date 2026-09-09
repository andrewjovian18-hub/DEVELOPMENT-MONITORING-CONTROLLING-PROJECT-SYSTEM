# Data Dictionary

## `10_PROJECT_MASTER`
Project_ID, Project_Name, Location, Project_Manager, PM_Email, Site_Lead, Site_Email, Project_Start, Project_Finish, Project_Status, Active, Created_At, Updated_At.

## `11_VENDOR_MASTER`
Vendor_ID, Discipline, Vendor_Name, Vendor_PIC, PIC_Email, Phone, Active, Vendor_Display.

## `12_USER_MASTER`
User_ID, Full_Name, Email, Role, Active.

## `14_USER_PROJECT_ACCESS`
User_ID, Project_ID, Active.

## `01_SRO`
A SRO_ID
B Planning_Sync_ID
C Project_ID
D Store_Location
E Request_Item
F Issuer
G Request_Date
H RO_Date
I Tender_Progress
J Tender_Status
K Execution_Duration_Source
L Original_Start
M Original_Finish
N Current_Start
O Current_Finish
P Duration_Days
Q Main_Vendor
R Supporting_Vendor
S Actual_Start
T Actual_Progress
U Actual_Finish
V Reporting_Cutoff
W Planned_Progress
X Variance_pp
Y Lifecycle_Status
Z Health_Status
AA Reporting_Status
AB Remaining_Days
AC Delay_Days
AD Issue
AE Mitigation
AF Remarks
AG Last_Progress_Update
AH Verification_Status
AI Closed_Date
AJ Baseline_Validation
AK Sync_Status
AL Proposed_Finish
AM Revision_Reason
AN Revision_Status
AO Created_At
AP Created_By
AQ Updated_At
AR Updated_By
AS Escalation_Level
AT Last_Reminder

## `02_HANDOVER_FINDING`
Finding_ID, Project_ID, Source_Reference, Source_Status, Finding_Type, Handover_Date, Finding_Description, Original_Notes, Vendor_ID, Vendor_PIC, PIC_Email, Start_Date, Original_Target_Finish, Current_Target_Finish, Duration_Days, Days_Remaining, Deadline_Status, Vendor_Confirmation, Confirmation_Date, Repair_Remarks, Evidence_Link, Actual_Finish, Verification_Status, Verified_By, Closed_Date, Reminder_Status, Last_Reminder, Proposed_Finish, Revision_Reason, Revision_Status, Created_At, Created_By, Updated_At, Updated_By.

## `24_HANDOVER_INTAKE`
Intake_ID, Source_Project, Source_Handover_Date, Source_Status, Raw_Description, Red_Note_Flag, Potential_Finding, Include_as_Finding, Finding_Description, Vendor, Source_Reference, Processed.

## `03_SPECIAL_INSTRUCTION`
SI_ID, SI_Form_No, Project_ID, SI_Date, SI_Title, SI_Description, Priority, Discipline, Vendor_ID, Vendor_PIC, Vendor_Email, Execution_Mode, Quotation_Required, Quotation_Submission_Date, Quotation_Value, Commercial_Status, PO_Number, PO_Date, Start_Date, Original_Target_Finish, Current_Target_Finish, Duration_Days, Days_Remaining, Execution_Status, Issue_Constraint, Vendor_Confirmation, PM_Remarks, Actual_Finish, Verification_Status, Closed_Date, Proposed_Finish, Revision_Reason, Revision_Status, Created_At, Created_By, Updated_At, Updated_By.

Execution_Mode: AFTER PO / PARALLEL.
Commercial_Status: NOT SUBMITTED / QUOTATION SUBMITTED / UNDER REVIEW / APPROVED / PO PROCESS / PO ISSUED.

## `04_OUTSTANDING`
Outstanding_ID, Project_ID, Date_Identified, Source_Type, Source_Reference, Discipline, Vendor_ID, Item_Pekerjaan, Start_Date, Original_Target_Finish, Current_Target_Finish, Duration_Days, Reporting_Cutoff, Planned_Progress, Actual_Progress, Variance_pp, Health_Status, Reporting_Status, Remaining_Days, Delay_Days, Outstanding_Reason, Issue_Constraint, Recovery_Action, PIC, Remarks, Last_Progress_Update, Actual_Finish, Verification_Status, Closed_Date, Proposed_Finish, Revision_Reason, Revision_Status, Created_At, Created_By, Updated_At, Updated_By, Escalation_Level, Last_Reminder.

## `20_PROGRESS_LOG`
Log_ID, Module, Record_ID, Project_ID, Cutoff_Date, Planned_Progress, Actual_Progress, Variance_pp, Health_Status, Created_At.

## `21_HISTORY_LOG`
Timestamp, User, Module, Record_ID, Field, Old_Value, New_Value, Change_Source.

## `22_REMINDER_LOG`
Reminder_ID, Module, Record_ID, Reminder_Type, Trigger_Date, Recipient, CC, Sent_At, Delivery_Status, Escalation_Level.

## `23_SYNC_LOG`
Sync_ID, Timestamp, SRO_ID, Planning_Record_ID, Direction, Field, Old_Value, New_Value, Result, Error_Message.

## `90_SETTINGS`
WEEKLY_CUTOFF_DAY=THURSDAY; WEEKLY_CUTOFF_TIME configurable; DELAY_THRESHOLD_PP=10; HANDOVER_REMINDER_DAYS=7; FOLLOWUP_REMINDER_DAYS=3; SI_REMINDER_DAYS=7; ESCALATION_LEVEL_1=3; ESCALATION_LEVEL_2=7; STALE_UPDATE_DAYS=7; PLANNING_SYNC_INTERVAL=15; PM_WEEKLY_REPORT_DAY=FRIDAY; EXEC_WEEKLY_REPORT_DAY=FRIDAY.

## `98_DASHBOARD_DATA`
Module, Record_ID, Project_ID, Project_Name, Vendor_ID, Vendor_Name, Item, Lifecycle_Status, Module_Status, Health_Band, Due_Date, Remaining_Days, Planned_Progress, Actual_Progress, Variance_pp, Reporting_Status, Last_Update, Critical_Flag, Attention_Reason, Priority_Score.
