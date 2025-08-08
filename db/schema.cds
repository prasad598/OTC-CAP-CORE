using { commonTypes } from './commonTypes';

namespace BTP;

entity CORE_USERS {
  key USER_EMAIL : commonTypes.emailId;
  USER_ID        : commonTypes.id;
  USER_HP        : commonTypes.mobile;
  USER_FNAME     : commonTypes.fName;
  USER_LNAME     : commonTypes.fName;
  IS_ACTIVE      : commonTypes.booleanYN;
  CREATED_AT     : Timestamp;
  CREATED_BY     : commonTypes.emailId;
  UPDATED_AT     : Timestamp;
  UPDATED_BY     : commonTypes.emailId;
}

entity CORE_ATTACHMENTS {
  key UUID           : commonTypes.uuid    @Core.Computed : true;
  REQ_TXN_ID         : commonTypes.id      not null;
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
  CREATED_BY         : commonTypes.emailId not null;
  CREATED_DATE       : commonTypes.dateTime default current_timestamp not null;
}

entity CORE_COMMENTS {
  key UUID           : commonTypes.uuid @Core.Computed : true;
  REQ_TXN_ID         : commonTypes.uuid not null;
  REQUEST_NO         : String(14);
  COMMENTS           : commonTypes.shortText not null;
  COMMENT_TYPE       : String(30); // type - document , milestone
  COMMENT_EVENT      : String(30); // title - Service Request Created
  USER_TYPE          : commonTypes.userType; // role - Expense Controller
  EVENT_STATUS_CD    : commonTypes.lookupCode;
  CREATED_BY         : commonTypes.emailId not null; // author
  CREATED_DATE       : commonTypes.dateTime default current_timestamp not null;
}

entity MON_WF_PROCESS {
  key WF_INSTANCE_ID    : commonTypes.id;

  WF_DESC               : String(255);
  WF_SUBJ               : String(255);
  WF_STATUS             : String(20);
  REQUEST_TYPE          : String(50);
  REQUEST_ID            : String(50);
  REQ_TXN_ID            : commonTypes.id;

  EST_COMPLETION        : commonTypes.dateTime;
  ACTUAL_COMPLETION     : commonTypes.dateTime;
  COMPLETED_BY          : commonTypes.userId;
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
  key TASK_INSTANCE_ID  : commonTypes.id;

  WF_INSTANCE_ID        : commonTypes.id;
  SWF_INSTANCE_ID       : commonTypes.id;
  REQ_TXN_ID            : commonTypes.id;

  TASK_DESC             : String(200);
  TASK_SUBJ             : String(250);
  TASK_STATUS           : String(20);
  COMPLETION_SOURCE     : String(50);
  USER_ACTION           : String(50);
  ACTION_TYPE           : String(50);
  TASK_TYPE             : commonTypes.lookupCode;
  ASSIGNED_GROUP        : String(250);

  EST_COMPLETION        : commonTypes.dateTime;
  ACTUAL_COMPLETION     : commonTypes.dateTime;
  COMPLETED_DATE        : commonTypes.dateTime;
  COMPLETED_BY          : commonTypes.userId;
  SLA_DAYS              : Integer;

  IS_ARCHIVED           : commonTypes.flag;
  IS_DELETED            : commonTypes.flag;

  CREATED_BY            : commonTypes.emailId;
  CREATED_DATETIME      : commonTypes.dateTime default current_timestamp;
  UPDATED_BY            : commonTypes.emailId;
  UPDATED_DATETIME      : commonTypes.dateTime default current_timestamp;
}

entity TE_SR {
  key REQ_TXN_ID       : commonTypes.uuid @Core.Computed : true;
  DRAFT_ID             : String(30);
  REQUEST_ID           : String(30);
  DECISION             : String(10) @cds.persistence.skip;

  REQUESTER_ID         : commonTypes.emailId;
  SRV_CAT_CD           : commonTypes.lookupCode;
  SR_DETAILS           : commonTypes.shortText;
  CASE_REQ_ID          : String(14);
  REQ_FOR_NAME         : commonTypes.fName;
  REQ_FOR_EMAIL        : commonTypes.emailId;
  REPORT_NO            : String(14);
  CASE_PRIO            : String(1);
  ENTITY_CD            : commonTypes.lookupCode;
  SECTOR_CD            : commonTypes.lookupCode;
  STATUS_CD            : commonTypes.lookupCode;
  RESOLUTION_RES       : commonTypes.shortText;
  CASE_BCG             : commonTypes.shortText;
  SRC_PROB_CD          : commonTypes.lookupCode;

  IS_CLAR_REQ          : commonTypes.booleanYN;
  IS_CLAR_REQ_DATETIME : commonTypes.dateTime;
  IS_ESCALATED         : commonTypes.booleanYN;
  ESCALATED_DATETIME   : commonTypes.dateTime;
  IS_CONFIRMED         : commonTypes.booleanYN;
  CONFIRMED_DATETIME   : commonTypes.dateTime;

  CREATED_BY           : commonTypes.emailId;
  CREATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now;
  UPDATED_BY           : commonTypes.emailId;
  UPDATED_DATETIME     : commonTypes.dateTime @cds.on.insert : $now @cds.on.update : $now;
}

entity CORE_REQ_SEQ {
  key SEQ_YEAR       : Integer;
  key REQUEST_TYPE   : String(50);
  key ID_TYPE        : String(10); // DRAFT or REQUEST
  LAST_SEQ_NO        : Integer;
  CREATED_BY         : commonTypes.emailId;
  CREATED_DATETIME   : commonTypes.dateTime default current_timestamp;
  UPDATED_BY         : commonTypes.emailId;
  UPDATED_DATETIME   : commonTypes.dateTime default current_timestamp;
}

entity AUTH_MATRIX {
  key ASSIGNED_GROUP    : commonTypes.lookupCode;
  key USER_EMAIL        : commonTypes.emailId;
  FIELD1                : commonTypes.field50;
  FIELD2                : commonTypes.field50;
  FIELD3                : commonTypes.field100;
  CREATED_BY            : commonTypes.emailId;
  CREATED_TIMESTAMP     : commonTypes.dateTime;
  UPDATED_BY            : commonTypes.emailId;
  UPDATED_TIMESTAMP     : commonTypes.dateTime;
}

entity CONFIG_LDATA {
  key PROJECT           : String(10) not null;
  key OBJECT            : String(10) not null;
  key CODE              : String(10) not null;
  DESC                  : String(100) not null;
  FIELD1                : commonTypes.field50;
  FIELD2                : commonTypes.field50;
  FIELD3                : commonTypes.field50;
  FIELD4                : commonTypes.field50;
  FIELD5                : commonTypes.field50;
  FIELD6                : commonTypes.field100;
  ACTIVE_FLAG           : String(1);
  CREATED_BY            : commonTypes.emailId not null;
  CREATED_TIMESTAMP     : commonTypes.dateTime not null;
  UPDATED_BY            : commonTypes.emailId not null;
  UPDATED_TIMESTAMP     : commonTypes.dateTime not null;
}
