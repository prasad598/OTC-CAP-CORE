using {
  BTP.id,
  BTP.emailId,
  BTP.mobile,
  BTP.fName,
  BTP.booleanYN,
  BTP.userId,
  BTP.uuid,
  BTP.fileName,
  BTP.fileSize,
  BTP.filePath,
  BTP.mimeType,
  BTP.userType,
  BTP.flag,
  BTP.dateTime,
  BTP.lookupCode,
  BTP.shortText
} from './types';

namespace BTP;

entity CORE_USERS {
  key USER_EMAIL : emailId;
  USER_ID        : id;
  USER_HP        : mobile;
  USER_FNAME     : fName;
  USER_LNAME     : fName;
  IS_ACTIVE      : booleanYN;
  CREATED_AT     : Timestamp;
  CREATED_BY     : userId;
  UPDATED_AT     : Timestamp;
  UPDATED_BY     : userId;
}

entity CORE_ATTACHMENTS {
  key UUID           : uuid    @Core.Computed : true;
  REQ_TXN_ID         : id      not null;
  REQUEST_NO         : String(14);
  FILE_NAME          : fileName not null;
  FILE_SIZE          : fileSize;
  FILE_PATH          : filePath not null;
  MIME_TYPE          : mimeType not null;
  DOCUMENT_TYPE      : String(50);
  PROJECT_TYPE       : String(30) not null;
  USER_TYPE          : userType; // Requester Approver
  RESTRICTED_USR_TY  : String(255);
  INC_AS_ATTACHMENT  : flag;
  IS_ARCHIVED        : flag;
  ARCH_FILE_PATH     : filePath;
  CREATED_BY         : userId not null;
  CREATED_DATE       : dateTime default current_timestamp not null;
}

entity CORE_COMMENTS {
  key UUID           : uuid @Core.Computed : true;
  REQ_TXN_ID         : uuid not null;
  REQUEST_NO         : String(14);
  COMMENTS           : shortText not null;
  COMMENT_TYPE       : String(30); // type - document , milestone
  COMMENT_EVENT      : String(30); // title - Service Request Created
  USER_TYPE          : userType; // role - Expense Controller
  EVENT_STATUS_CD    : lookupCode;
  CREATED_BY         : userId not null; // author
  CREATED_DATE       : dateTime default current_timestamp not null;
}

entity MON_WF_PROCESS {
  key WF_INSTANCE_ID    : id;

  WF_DESC               : String(255);
  WF_SUBJ               : String(255);
  WF_STATUS             : String(20);
  REQUEST_TYPE          : String(50);
  REQUEST_ID            : String(50);
  REQ_TXN_ID            : id;

  EST_COMPLETION        : dateTime;
  ACTUAL_COMPLETION     : dateTime;
  COMPLETED_BY          : userId;
  SLA_DAYS              : Integer;

  IS_ACTIVE             : flag;
  IS_ARCHIVED           : flag;
  IS_DELETED            : flag;

  CREATED_BY            : userId;
  CREATED_DATETIME      : dateTime default current_timestamp;
  UPDATED_BY            : userId;
  UPDATED_DATETIME      : dateTime default current_timestamp;
}

entity MON_WF_TASK {
  key TASK_INSTANCE_ID  : id;

  WF_INSTANCE_ID        : id;
  REQ_TXN_ID            : id;

  TASK_DESC             : String(200);
  TASK_SUBJ             : String(250);
  TASK_STATUS           : String(20);
  COMPLETION_SOURCE     : String(50);
  USER_ACTION           : String(50);
  ACTION_TYPE           : String(50);
  ASSIGNED_GROUP        : String(250);

  EST_COMPLETION        : dateTime;
  ACTUAL_COMPLETION     : dateTime;
  COMPLETED_DATE        : dateTime;
  COMPLETED_BY          : userId;
  SLA_DAYS              : Integer;

  IS_ARCHIVED           : flag;
  IS_DELETED            : flag;

  CREATED_BY            : userId;
  CREATED_DATETIME      : dateTime default current_timestamp;
  UPDATED_BY            : userId;
  UPDATED_DATETIME      : dateTime default current_timestamp;
}

entity TE_SR {
  key REQ_TXN_ID       : uuid @Core.Computed : true;
  DRAFT_ID             : String(12);
  REQUEST_ID           : String(14);

  REQUESTER_ID         : emailId;
  SRV_CAT_CD           : lookupCode;
  SR_DETAILS           : shortText;
  CASE_REQ_ID          : String(14);
  REQ_FOR_NAME         : fName;
  REQ_FOR_EMAIL        : emailId;
  REPORT_NO            : String(14);
  CASE_PRIO            : String(1);
  ENTITY_CD            : lookupCode;
  SECTOR_CD            : lookupCode;
  STATUS_CD            : lookupCode;
  RESOLUTION_RES       : shortText;
  CASE_BCG             : shortText;
  SRC_PROB_CD          : lookupCode;

  IS_CLAR_REQ          : booleanYN;
  IS_CLAR_REQ_DATETIME : dateTime;
  IS_ESCALATED         : booleanYN;
  ESCALATED_DATETIME   : dateTime;
  IS_CONFIRMED         : booleanYN;
  CONFIRMED_DATETIME   : dateTime;

  CREATED_BY           : userId;
  CREATED_DATETIME     : dateTime @cds.on.insert : $now;
  UPDATED_BY           : userId;
  UPDATED_DATETIME     : dateTime @cds.on.insert : $now @cds.on.update : $now;
}
