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
  key UUID           : uuid    not null;
  TRANSACTION_ID     : id      not null;
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
  CREATED_DATE       : dateTime not null;
}

entity CORE_COMMENTS {
  key UUID           : uuid not null;
  TRANSACTION_ID     : uuid not null;
  REQUEST_NO         : String(14);
  COMMENTS           : shortText not null;
  COMMENT_TYPE       : String(30); // type - document , milestone
  COMMENT_EVENT      : String(30); // title - Service Request Created
  USER_TYPE          : userType; // role - Expense Controller
  EVENT_STATUS_CD    : lookupCode;
  CREATED_BY         : userId not null; // author
  CREATED_DATE       : dateTime not null;
}
