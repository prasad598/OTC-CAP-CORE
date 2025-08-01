using BTP as core from '../db/schema';

service UserService {
  entity CORE_USERS as projection on core.CORE_USERS;
}

service RestService @protocol: 'rest' {
  entity CORE_ATTACHMENTS as projection on core.CORE_ATTACHMENTS;
  entity CORE_COMMENTS as projection on core.CORE_COMMENTS;
}
