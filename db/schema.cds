using { BTP.id, BTP.emailId, BTP.mobile, BTP.fName, BTP.booleanYN, BTP.userId } from './types';

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
