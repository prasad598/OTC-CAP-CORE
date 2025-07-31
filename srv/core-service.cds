using HC_BTP as core from '../db/schema';

service UserService {
  @readonly entity BTP_CORE_USERS as projection on core.BTP_CORE_USERS;
}
