namespace BTP;

entity CORE_USERS {
  key USER_EMAIL : String(241);
  USER_ID        : String(120);
  USER_HP        : String(30);
  USER_FNAME     : String(40);
  USER_LNAME     : String(40);
  IS_ACTIVE      : String(1);
  CREATED_AT     : Timestamp;
  CREATED_BY     : String(12);
  UPDATED_AT     : Timestamp;
  UPDATED_BY     : String(12);
}
