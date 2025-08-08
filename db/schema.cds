using { commonTypes } from './commonTypes';

namespace BTP;

entity CORE_USERS {
  key USER_EMAIL : commonTypes.emailId;
  USER_ID        : commonTypes.id;
  USER_HP        : commonTypes.mobile;
  USER_FNAME     : commonTypes.fName;
  USER_LNAME     : commonTypes.fName;
  IS_ACTIVE      : commonTypes.booleanYN;
  CREATED_BY           : commonTypes.emailId;
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
  UPDATED_BY           : commonTypes.emailId;
  UPDATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now @cds.on.update : $now;
}

entity CORE_ATTACHMENTS {
  key UUID           : commonTypes.uuid    @Core.Computed : true;
  REQ_TXN_ID         : commonTypes.uuidv4  not null;
  REQUEST_NO         : String(14);
  FILE_NAME          : commonTypes.fileName not null;
  FILE_SIZE          : commonTypes.fileSize;
  FILE_PATH          : commonTypes.filePath not null;
  MIME_TYPE          : commonTypes.mimeType not null;
  DOCUMENT_TYPE      : String(50);
  PROJECT_TYPE       : String(30) not null;
  USER_TYPE          : commonTypes.userType; // Requester Approver
  RESTRICTED_USR_TY  : String(255);
  INC_AS_ATTACHMENT  : commonTypes.flag;
  IS_ARCHIVED        : commonTypes.flag;
  ARCH_FILE_PATH     : commonTypes.filePath;
  CREATED_BY           : commonTypes.emailId;
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
}

entity CORE_COMMENTS {
  key UUID           : commonTypes.uuid @Core.Computed : true;
  REQ_TXN_ID         : commonTypes.uuidv4 not null;
  REQUEST_ID         : commonTypes.requestId;
  COMMENTS           : commonTypes.shortText not null;
  COMMENT_TYPE       : commonTypes.commentType; // type - document , milestone
  COMMENT_EVENT      : commonTypes.commentEvent; // title - Service Request Created
  USER_TYPE          : commonTypes.userType; // role - Expense Controller
  EVENT_STATUS_CD    : commonTypes.lookupCode;
  CREATED_BY           : commonTypes.emailId; // author
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
}

entity MON_WF_PROCESS {
  key WF_INSTANCE_ID    : commonTypes.uuidv4;

  WF_DESC               : String(255);
  WF_SUBJ               : String(255);
  WF_STATUS             : commonTypes.statusSBPA;
  REQUEST_TYPE          : commonTypes.requestType;
  REQUEST_ID            : commonTypes.requestId;
  REQ_TXN_ID            : commonTypes.uuidv4;

  EST_COMPLETION        : commonTypes.dateTime;
  ACTUAL_COMPLETION     : commonTypes.dateTime;
  SLA_DAYS              : Integer;

  IS_ACTIVE             : commonTypes.flag;
  IS_ARCHIVED           : commonTypes.flag;
  IS_DELETED            : commonTypes.flag;

  CREATED_BY            : commonTypes.emailId;
  CREATED_DATETIME      : commonTypes.dateTime default current_timestamp;
  UPDATED_BY            : commonTypes.emailId;
  UPDATED_DATETIME      : commonTypes.dateTime default current_timestamp;
}

entity MON_WF_TASK {
  key TASK_INSTANCE_ID  : commonTypes.uuidv4;

  WF_INSTANCE_ID        : commonTypes.uuidv4;
  SWF_INSTANCE_ID       : commonTypes.uuidv4;
  REQ_TXN_ID            : commonTypes.uuidv4;

  TASK_DESC             : String(200);
  TASK_SUBJ             : String(250);
  TASK_STATUS           : commonTypes.statusSBPA;
  TASK_TYPE             : commonTypes.taskType;
  ASSIGNED_GROUP        : commonTypes.iasGroup;
  DECISION              : commonTypes.decision;
  PROCESSOR             : commonTypes.emailId;

  EST_COMPLETION        : commonTypes.dateTime;
  ACTUAL_COMPLETION     : commonTypes.dateTime;
  COMPLETED_DATE        : commonTypes.dateTime;
  SLA_DAYS              : Integer;

  IS_ARCHIVED           : commonTypes.flag;
  IS_DELETED            : commonTypes.flag;

  CREATED_BY            : commonTypes.emailId;
  CREATED_DATETIME      : commonTypes.dateTime default current_timestamp;
  UPDATED_BY            : commonTypes.emailId;
  UPDATED_DATETIME      : commonTypes.dateTime default current_timestamp;
}

entity TE_SR {
  key REQ_TXN_ID       : commonTypes.uuidv4 @Core.Computed : true;
  DRAFT_ID             : String(30);
  REQUEST_ID           : String(30);
  DECISION             : commonTypes.decision @cds.persistence.skip;

  REQUESTER_ID         : commonTypes.emailId;
  SRV_CAT_CD           : commonTypes.lookupCode;
  SR_DETAILS           : commonTypes.shortText;
  CASE_REQ_ID          : String(14);
  REQ_FOR_NAME         : commonTypes.fName;
  REQ_FOR_EMAIL        : commonTypes.emailId;
  REPORT_NO            : String(14);
  CASE_PRIO            : String(1);
  ENTITY_CD            : commonTypes.lookupCode;
  STATUS_CD            : commonTypes.lookupCode;
  RESOLUTION_RES       : commonTypes.shortText;
  CASE_BCG             : commonTypes.shortText;
  SRC_PROB_CD          : commonTypes.lookupCode;

  IS_CLAR_REQ          : commonTypes.booleanYN;
  IS_CLAR_REQ_DATETIME : commonTypes.dateTime;
  IS_ESCALATED         : commonTypes.booleanYN;
  ESCALATED_DATETIME   : commonTypes.dateTime;
  IS_RESOLVED          : commonTypes.booleanYN;
  RESOLVED_DATETIME    : commonTypes.dateTime;

  CREATED_BY           : commonTypes.emailId;
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
  UPDATED_BY           : commonTypes.emailId;
  UPDATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now @cds.on.update : $now;
}

entity CORE_REQ_SEQ {
  key SEQ_YEAR       : Integer;
  key REQUEST_TYPE   : commonTypes.requestType;
  key ID_TYPE        : String(10); // DRAFT or REQUEST
  LAST_SEQ_NO        : Integer;
  CREATED_BY           : commonTypes.emailId; //logged in user email id
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
  UPDATED_BY           : commonTypes.emailId; //logged in user email id
  UPDATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now @cds.on.update : $now;
}

entity AUTH_MATRIX {
  key ASSIGNED_GROUP    : commonTypes.iasGroup;
  key USER_EMAIL        : commonTypes.emailId;
  FIELD1                : commonTypes.field50;
  FIELD2                : commonTypes.field50;
  FIELD3                : commonTypes.field100;
  CREATED_BY           : commonTypes.emailId; //logged in user email id
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
  UPDATED_BY           : commonTypes.emailId; //logged in user email id
  UPDATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now @cds.on.update : $now;
}

entity CONFIG_LDATA {
  key PROJECT       : String(10) not null;
  key REQUEST_TYPE  : commonTypes.requestType;
  key CODE          : commonTypes.lookupCode;
  DESC              : commonTypes.shortText;
  FIELD1            : commonTypes.field50;
  FIELD2            : commonTypes.field50;
  FIELD3            : commonTypes.field50;
  FIELD4            : commonTypes.field50;
  FIELD5            : commonTypes.field50;
  FIELD6            : commonTypes.field100;
  ACTIVE_FLAG       : String(1);
  CREATED_BY           : commonTypes.emailId; //logged in user email id
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
  UPDATED_BY           : commonTypes.emailId; //logged in user email id
  UPDATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now @cds.on.update : $now;
}
