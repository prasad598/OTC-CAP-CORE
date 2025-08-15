using { commonTypes } from './commonTypes';

namespace BTP;

aspect Auditable {
  /**
   * Email ID of the user who created the record
   */
  CREATED_BY       : commonTypes.emailId;

  /**
   * Creation timestamp:
   * - If caller sends value, it will be stored
   * - If omitted, defaults to $now at insert
   */
  CREATED_DATETIME : commonTypes.dateTime
                      default $now
                      @cds.on.insert : $now;

  /**
   * Email ID of the user who last updated the record
   */
  UPDATED_BY       : commonTypes.emailId;

  /**
   * Update timestamp:
   * - If caller sends value, it will be stored
   * - If omitted at insert, defaults to $now
   * - On update, defaults to $now unless caller provides value
   */
  UPDATED_DATETIME : commonTypes.dateTime
                      default $now
                      @cds.on.insert : $now
                      @cds.on.update : $now;
}

aspect RequestReference {
  REQ_TXN_ID   : commonTypes.uuidv4;
  REQUEST_ID   : commonTypes.requestId;
  REQUEST_TYPE : commonTypes.requestType;
}

entity CORE_USERS : Auditable {
  key USER_EMAIL : commonTypes.emailId;
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code
  USER_ID        : commonTypes.id;
  USER_HP        : commonTypes.mobile;
  USER_FNAME     : commonTypes.fName;
  USER_LNAME     : commonTypes.fName;
  IS_ACTIVE      : commonTypes.booleanYN;
}

entity CORE_ATTACHMENTS {
  key UUID           : commonTypes.uuid    @Core.Computed : true;
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code
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
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code
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

entity MON_WF_PROCESS : Auditable, RequestReference {
  key WF_INSTANCE_ID    : commonTypes.uuidv4;
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code

  WF_DESC               : String(255);
  WF_SUBJ               : String(255);
  WF_STATUS             : commonTypes.statusSBPA;

  EST_COMPLETION        : commonTypes.dateTime;
  ACTUAL_COMPLETION     : commonTypes.dateTime;
  SLA_DAYS              : Integer;

  IS_ACTIVE             : commonTypes.flag;
  IS_ARCHIVED           : commonTypes.flag;
  IS_DELETED            : commonTypes.flag;
}

entity MON_WF_TASK : Auditable {
  key TASK_INSTANCE_ID  : commonTypes.uuidv4;
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code

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
}

entity TE_SR : Auditable {
  key REQ_TXN_ID       : commonTypes.uuidv4 @Core.Computed : true;
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code
  DRAFT_ID             : String(30);
  REQUEST_ID           : String(30);
  DECISION             : commonTypes.decision @cds.persistence.skip;

  virtual user_scim_id : String @cds.odata.name:'user-scim-id';

  PROCESSOR            : commonTypes.emailId;

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
  IS_CLOSED            : commonTypes.booleanYN;
  CLOSED_DATETIME      : commonTypes.dateTime;
}

entity CORE_REQ_SEQ : Auditable {
  key SEQ_YEAR       : Integer;
  key REQUEST_TYPE   : commonTypes.requestType;
  key ID_TYPE        : String(10); // DRAFT or REQUEST
  LAST_SEQ_NO        : Integer;
}

entity AUTH_MATRIX : Auditable {
  key ASSIGNED_GROUP    : commonTypes.iasGroup;
  key USER_EMAIL        : commonTypes.emailId;
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code
  FIELD1                : commonTypes.field50;
  FIELD2                : commonTypes.field50;
  FIELD3                : commonTypes.field100;
}

entity CONFIG_LDATA : Auditable {
  key REQUEST_TYPE  : commonTypes.requestType;
  key OBJECT       : String(10) not null;
  key CODE          : commonTypes.lookupCode;
  language : String(2) @Semantics.language default 'EN'; // ISO 639-1 language code
  DESC              : commonTypes.shortText;
  FIELD1            : commonTypes.field50;
  FIELD2            : commonTypes.field50;
  FIELD3            : commonTypes.field50;
  FIELD4            : commonTypes.field50;
  FIELD5            : commonTypes.field50;
  FIELD6            : commonTypes.field100;
  IS_ACTIVE         : commonTypes.flag;
}
